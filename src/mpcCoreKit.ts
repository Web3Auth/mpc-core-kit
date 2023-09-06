import { encrypt, getPubKeyECC, getPubKeyPoint, KeyDetails, Point as TkeyPoint, ShareStore } from "@tkey-mpc/common-types";
import ThresholdKey, { CoreError } from "@tkey-mpc/core";
import { TorusServiceProvider } from "@tkey-mpc/service-provider-torus";
import { ShareSerializationModule } from "@tkey-mpc/share-serialization";
import { TorusStorageLayer } from "@tkey-mpc/storage-layer-torus";
import { AGGREGATE_VERIFIER, TORUS_METHOD, TorusAggregateLoginResponse, TorusLoginResponse, UX_MODE } from "@toruslabs/customauth";
import { generatePrivate } from "@toruslabs/eccrypto";
import { NodeDetailManager } from "@toruslabs/fetch-node-details";
import { keccak256 } from "@toruslabs/metadata-helpers";
import { OpenloginSessionManager } from "@toruslabs/openlogin-session-manager";
import TorusUtils, { TorusKey } from "@toruslabs/torus.js";
import { Client, utils as tssUtils } from "@toruslabs/tss-client";
import { CHAIN_NAMESPACES, log, SafeEventEmitterProvider } from "@web3auth/base";
import { EthereumSigningProvider } from "@web3auth-mpc/ethereum-provider";
import BN from "bn.js";

import { BrowserStorage } from "./browserStorage";
import {
  CURVE,
  DEFAULT_CHAIN_CONFIG,
  DELIMITERS,
  ERRORS,
  FactorKeyTypeShareDescription,
  FIELD_ELEMENT_HEX_LEN,
  MAX_FACTORS,
  SCALAR_HEX_LEN,
  SOCIAL_TKEY_INDEX,
  TssFactorIndexType,
  VALID_SHARE_INDICES,
  WEB3AUTH_NETWORK,
} from "./constants";
import {
  AggregateVerifierLoginParams,
  FactorKeyCloudMetadata,
  ICoreKit,
  IdTokenLoginParams,
  OauthLoginParams,
  SessionData,
  SubVerifierDetailsParams,
  TkeyLocalStoreData,
  UserInfo,
  Web3AuthOptions,
  Web3AuthOptionsWithDefaults,
  Web3AuthState,
} from "./interfaces";
import { Point } from "./point";
import { addFactorAndRefresh, deleteFactorAndRefresh, generateTSSEndpoints, parseToken } from "./utils";

export class Web3AuthMPCCoreKit implements ICoreKit {
  private options: Web3AuthOptionsWithDefaults;

  private privKeyProvider: EthereumSigningProvider | null = null;

  private torusSp: TorusServiceProvider | null = null;

  private storageLayer: TorusStorageLayer | null = null;

  private tkey: ThresholdKey | null = null;

  private state: Web3AuthState = {};

  private sessionManager!: OpenloginSessionManager<SessionData>;

  private currentStorage!: BrowserStorage;

  private nodeDetailManager!: NodeDetailManager;

  private _storageBaseKey = "corekit_store";

  constructor(options: Web3AuthOptions) {
    if (!options.chainConfig) options.chainConfig = DEFAULT_CHAIN_CONFIG;
    if (options.chainConfig.chainNamespace !== CHAIN_NAMESPACES.EIP155) {
      throw new Error("You must specify a eip155 chain config.");
    }
    if (!options.web3AuthClientId) {
      throw new Error("You must specify a web3auth clientId.");
    }

    if (options.enableLogging) log.enableAll();
    else log.setLevel("error");
    if (typeof options.manualSync !== "boolean") options.manualSync = false;
    if (!options.web3AuthNetwork) options.web3AuthNetwork = WEB3AUTH_NETWORK.MAINNET;
    if (!options.storageKey) options.storageKey = "local";
    if (!options.sessionTime) options.sessionTime = 86400;
    if (!options.uxMode) options.uxMode = UX_MODE.REDIRECT;

    this.options = options as Web3AuthOptionsWithDefaults;

    this.currentStorage = BrowserStorage.getInstance(this._storageBaseKey, this.options.storageKey);

    const sessionId = this.currentStorage.get<string>("sessionId");
    this.sessionManager = new OpenloginSessionManager({
      sessionTime: this.options.sessionTime,
      sessionId,
    });

    this.nodeDetailManager = new NodeDetailManager({
      network: this.options.web3AuthNetwork,
      enableLogging: true,
    });
  }

  get provider(): SafeEventEmitterProvider | undefined {
    return this.privKeyProvider?.provider ? this.privKeyProvider.provider : undefined;
  }

  get tKey(): ThresholdKey {
    if (this.tkey === null) throw new Error("Tkey not initialized");
    return this.tkey;
  }

  private get verifier(): string {
    if (this.state.userInfo?.aggregateVerifier) {
      return this.state.userInfo.aggregateVerifier;
    }
    return this.state?.userInfo?.verifier ? this.state.userInfo.verifier : "";
  }

  private get verifierId(): string {
    return this.state?.userInfo?.verifierId ? this.state.userInfo.verifierId : "";
  }

  private get signatures(): string[] {
    return this.state?.signatures ? this.state.signatures : [];
  }

  private get isRedirectMode(): boolean {
    return this.options.uxMode === UX_MODE.REDIRECT;
  }

  public async loginWithOauth(params: OauthLoginParams, factorKey: BN | undefined = undefined): Promise<SafeEventEmitterProvider | null> {
    if (!this.tkey) {
      await this.init();
    }

    const tkeyServiceProvider = this.tKey.serviceProvider as TorusServiceProvider;
    try {
      // oAuth login.
      const verifierParams = params as SubVerifierDetailsParams;
      const aggregateParams = params as AggregateVerifierLoginParams;
      if (verifierParams.subVerifierDetails) {
        // single verifier login.
        const loginResponse = await tkeyServiceProvider.triggerLogin((params as SubVerifierDetailsParams).subVerifierDetails);

        if (this.isRedirectMode) return null;

        this.updateState({
          oAuthKey: this._getOAuthKey(loginResponse),
          userInfo: loginResponse.userInfo,
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
      } else if (aggregateParams.subVerifierDetailsArray) {
        const loginResponse = await tkeyServiceProvider.triggerAggregateLogin({
          aggregateVerifierType: aggregateParams.aggregateVerifierType || AGGREGATE_VERIFIER.SINGLE_VERIFIER_ID,
          verifierIdentifier: aggregateParams.aggregateVerifierIdentifier as string,
          subVerifierDetailsArray: aggregateParams.subVerifierDetailsArray,
        });

        if (this.isRedirectMode) return null;

        this.updateState({
          oAuthKey: this._getOAuthKey(loginResponse),
          userInfo: loginResponse.userInfo[0],
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
      }

      await this.setupTkey(factorKey);
      if (!this.provider) throw new Error("provider not initialized");
      return this.provider;
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error((err as Error).message);
    }
  }

  public async login(idTokenLoginParams: IdTokenLoginParams, factorKey: BN | undefined = undefined) {
    if (!this.tkey) {
      await this.init();
    }
    const { verifier, verifierId, idToken } = idTokenLoginParams;
    try {
      // oAuth login.
      if (!idTokenLoginParams.subVerifier) {
        // single verifier login.
        const loginResponse = await (this.tKey.serviceProvider as TorusServiceProvider).directWeb.getTorusKey(
          verifier,
          verifierId,
          { verifier_id: verifierId },
          idToken,
          {
            ...idTokenLoginParams.extraVerifierParams,
            ...idTokenLoginParams.additionalParams,
          }
        );
        const OAuthShare = this._getOAuthKey(loginResponse);

        (this.tKey.serviceProvider as TorusServiceProvider).postboxKey = new BN(OAuthShare, "hex");
        (this.tKey.serviceProvider as TorusServiceProvider).verifierName = verifier;
        (this.tKey.serviceProvider as TorusServiceProvider).verifierId = verifierId;
        (this.tKey.serviceProvider as TorusServiceProvider).verifierType = "normal";

        this.updateState({
          oAuthKey: OAuthShare,
          userInfo: { ...parseToken(idToken), verifier, verifierId },
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
      } else {
        // aggregate verifier login
        const loginResponse = await (this.tKey.serviceProvider as TorusServiceProvider).directWeb.getAggregateTorusKey(verifier, verifierId, [
          { verifier: idTokenLoginParams.subVerifier, idToken, extraVerifierParams: idTokenLoginParams.extraVerifierParams },
        ]);
        const OAuthShare = this._getOAuthKey(loginResponse);

        (this.tKey.serviceProvider as TorusServiceProvider).postboxKey = new BN(OAuthShare, "hex");
        (this.tKey.serviceProvider as TorusServiceProvider).verifierName = verifier;
        (this.tKey.serviceProvider as TorusServiceProvider).verifierId = verifierId;
        (this.tKey.serviceProvider as TorusServiceProvider).verifierType = "aggregate";

        this.updateState({
          oAuthKey: OAuthShare,
          userInfo: { ...parseToken(idToken), verifier, verifierId },
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
      }

      await this.setupTkey(factorKey);
      if (!this.provider) throw new Error("provider not initialized");
      return this.provider;
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error((err as Error).message);
    }
  }

  // TODO: rename function to something more descriptive
  public async inputFactorKey(factorKey: BN): Promise<SafeEventEmitterProvider> {
    if (!this.tkey) throw new Error("tkey not initialized, call login first!");
    await this.setupTkey(factorKey);
    if (!this.provider) throw new Error("provider not initialized");
    return this.provider;
  }

  // TODO Edited, but not tested. Need to test before enabling it! Edit example to test it. @Yash
  public async handleRedirectResult(factorKey: BN | undefined = undefined): Promise<SafeEventEmitterProvider> {
    if (!this.tkey || !this.torusSp) {
      await this.init();
    }
    if (!this.torusSp) {
      throw new Error("tkey is not initialized, call init first");
    }
    try {
      const result = await this.torusSp.directWeb.getRedirectResult();

      if (result.method === TORUS_METHOD.TRIGGER_LOGIN) {
        const data = result.result as TorusLoginResponse;
        if (!data) throw new Error("Invalid login params passed");
        this.updateState({
          oAuthKey: this._getOAuthKey(data),
          userInfo: data.userInfo,
          signatures: this._getSignatures(data.sessionData.sessionTokenData),
        });
        this.torusSp.verifierType = "normal";
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.verifier;
      } else if (result.method === TORUS_METHOD.TRIGGER_AGGREGATE_LOGIN) {
        const data = result.result as TorusAggregateLoginResponse;
        if (!data) throw new Error("Invalid login params passed");
        this.updateState({
          oAuthKey: this._getOAuthKey(data),
          userInfo: data.userInfo[0],
          signatures: this._getSignatures(data.sessionData.sessionTokenData),
        });
        this.torusSp.verifierType = "aggregate";
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.aggregateVerifier;
      } else {
        throw new Error("Unsupported method type");
      }

      const userInfo = this.getUserInfo();
      if (!this.state.oAuthKey) throw new Error("oAuthKey not present");
      this.torusSp.postboxKey = new BN(this.state.oAuthKey, "hex");
      this.torusSp.verifierId = userInfo.verifierId;
      await this.setupTkey(factorKey);

      if (!this.provider) throw new Error("provider not initialized");
      return this.provider;
    } catch (error: unknown) {
      log.error("error while handling redirect result", error);
      throw new Error((error as Error).message);
    }
  }

  isResumable(): boolean {
    return Boolean(this.sessionManager.sessionKey);
  }

  public async resumeSession(): Promise<SafeEventEmitterProvider> {
    if (!this.sessionManager.sessionKey) {
      throw new Error("Session does not exist.");
    }

    await this.init();
    await this.rehydrateSession();
    await this.setupProvider();
    if (!this.provider) throw new Error("provider not initialized");
    return this.provider;
  }

  public async createFactor(
    factorKey: BN,
    shareType: TssFactorIndexType,
    shareDescription: FactorKeyTypeShareDescription = FactorKeyTypeShareDescription.Other,
    additionalMetadata: Record<string, string> = {}
  ): Promise<void> {
    this.checkTkey();

    if (!VALID_SHARE_INDICES.includes(shareType)) {
      throw new Error(`invalid share type: must be one of ${VALID_SHARE_INDICES}`);
    }

    try {
      const factorPub = getPubKeyPoint(factorKey);
      await this.copyOrCreateShare(shareType, factorPub);
      await this.backupShareWithFactorKey(factorKey);
      await this.addFactorDescription(factorKey, shareDescription, additionalMetadata);
      if (!this.options.manualSync) await this.tKey.syncLocalMetadataTransitions();
    } catch (error) {
      log.error("error creating factor", error);
      throw error;
    }
  }

  async deleteFactor(factorPub: TkeyPoint): Promise<void> {
    if (!this.state.factorKey) throw new Error("Factor key not present");
    if (!this.tKey.metadata.factorPubs) throw new Error("Factor pubs not present");
    const remainingFactors = this.tKey.metadata.factorPubs[this.tKey.tssTag].length || 0;
    if (remainingFactors <= 1) throw new Error("Cannot delete last factor");

    await deleteFactorAndRefresh(this.tKey, factorPub, this.state.factorKey, this.signatures);
    const factorPubHex = Point.fromTkeyPoint(factorPub).toBufferSEC1(false).toString("hex");
    const allDesc = this.tKey.metadata.getShareDescription();
    const keyDesc = allDesc[factorPubHex];
    if (keyDesc) {
      keyDesc.forEach(async (desc) => {
        await this.tKey?.deleteShareDescription(factorPubHex, desc, true);
      });
    }

    if (!this.options.manualSync) await this.tKey.syncLocalMetadataTransitions();
  }

  generateFactorKey(): { private: BN; pub: TkeyPoint } {
    const factorKey = new BN(generatePrivate());
    const factorPub = getPubKeyPoint(factorKey);
    return { private: factorKey, pub: factorPub };
  }

  public getUserInfo(): UserInfo {
    if (!this.state.userInfo) {
      throw new Error("user is not logged in.");
    }
    return this.state.userInfo;
  }

  public getKeyDetails(): KeyDetails & { tssIndex: number } {
    this.checkTkey();
    const keyDetails = this.tKey.getKeyDetails();
    keyDetails.shareDescriptions = this.tKey.getMetadata().getShareDescription();
    if (!this.state.tssShareIndex) throw new Error("tssShareIndex not present");
    return { ...keyDetails, tssIndex: this.state.tssShareIndex };
  }

  public async commitChanges(): Promise<void> {
    this.checkTkey();
    if (!this.state.factorKey) {
      throw new Error("factorKey not present.");
    }
    try {
      await this.tKey._syncShareMetadata();
      await this.tKey.syncLocalMetadataTransitions();
    } catch (error: unknown) {
      log.error("sync metadata error", error);
      throw error;
    }
  }

  public async logout(): Promise<void> {
    if (!this.sessionManager.sessionKey) {
      throw new Error("User is not logged in.");
    }
    await this.sessionManager.invalidateSession();
    this.currentStorage.set("sessionId", "");
    this.resetState();
  }

  public async importTssKey(tssKey: string, factorPub: TkeyPoint, newTSSIndex: TssFactorIndexType = TssFactorIndexType.DEVICE): Promise<void> {
    if (!this.state.signatures) throw new Error("signatures not present");

    const tssKeyBN = new BN(tssKey, "hex");
    this.tKey.importTssKey({ tag: this.tKey.tssTag, importKey: tssKeyBN, factorPub, newTSSIndex }, { authSignatures: this.state.signatures });
  }

  public async _UNSAFE_exportTssKey(): Promise<string> {
    if (!this.state.factorKey) throw new Error("factorKey not present");
    if (!this.state.signatures) throw new Error("signatures not present");

    const exportTssKey = await this.tKey._UNSAFE_exportTssKey({
      factorKey: this.state.factorKey,
      authSignatures: this.state.signatures,
      selectedServers: [],
    });

    return exportTssKey.toString("hex");
  }

  public async CRITICAL_resetAccount(): Promise<void> {
    this.checkTkey();

    if (!this.state.oAuthKey) {
      throw new Error("user not logged in");
    }
    await this.tKey.storageLayer.setMetadata({
      privKey: new BN(this.state.oAuthKey, "hex"),
      input: { message: "KEY_NOT_FOUND" },
    });
    this.currentStorage.resetStore();
    this.resetState();
  }

  /**
   * Initialize component. Does not initialize tKey yet.
   */
  private async init(): Promise<void> {
    // TODO why is this always using test-verifier? what if we use google login?
    // TODO use constants with "default" for verifier and verifierId
    const nodeDetails = await this.nodeDetailManager.getNodeDetails({ verifier: "test-verifier", verifierId: "test@example.com" });

    if (!nodeDetails) {
      throw new Error("error getting node details, please try again!");
    }

    this.torusSp = new TorusServiceProvider({
      useTSS: true,
      customAuthArgs: {
        web3AuthClientId: this.options.web3AuthClientId,
        baseUrl: this.options.baseUrl ? this.options.baseUrl : `${window.location.origin}/serviceworker`,
        uxMode: this.options.uxMode,
        network: this.options.web3AuthNetwork,
      },
      nodeEndpoints: nodeDetails.torusNodeEndpoints,
      nodePubKeys: nodeDetails.torusNodePub.map((i) => ({ x: i.X, y: i.Y })),
    });

    this.storageLayer = new TorusStorageLayer({
      hostUrl: `${new URL(nodeDetails.torusNodeEndpoints[0]).origin}/metadata`,
      enableLogging: true,
    });

    const shareSerializationModule = new ShareSerializationModule();

    this.tkey = new ThresholdKey({
      enableLogging: true,
      serviceProvider: this.torusSp,
      storageLayer: this.storageLayer,
      manualSync: this.options.manualSync,
      modules: {
        shareSerialization: shareSerializationModule,
      },
    });

    // TODO works unreliably with `init({skipSw: true, skipPrefetch: true})`.
    // Need to fix service provider? if popup, then `skipSw` and `skipPrefetch` need to be false.
    await (this.tKey.serviceProvider as TorusServiceProvider).init({});
    this.updateState({ tssNodeEndpoints: nodeDetails.torusNodeTSSEndpoints });
  }

  private async setupTkey(factorKey: BN | undefined = undefined): Promise<void> {
    if (!this.state.oAuthKey) {
      throw new Error("user not logged in");
    }
    const existingUser = await this.isMetadataPresent(this.state.oAuthKey);

    if (!existingUser) {
      // Generate new factor key if not provided.
      if (!factorKey) {
        factorKey = new BN(generatePrivate());
      }

      // Generate and device share and initialize tkey with it.
      const deviceTSSShare = new BN(generatePrivate());
      const deviceTSSIndex = TssFactorIndexType.DEVICE;
      const factorPub = getPubKeyPoint(factorKey);
      await this.tKey.initialize({ useTSS: true, factorPub, deviceTSSShare, deviceTSSIndex });

      // Finalize initialization.
      await this.tKey.reconstructKey();
      await this.finalizeTkey(factorKey);

      // Store factor description.
      await this.backupShareWithFactorKey(factorKey);
      await this.addFactorDescription(factorKey, FactorKeyTypeShareDescription.DeviceShare);
    } else {
      // Initialize tkey with existing share.
      await this.tKey.initialize({ neverInitializeNewKey: true });

      if (!factorKey) {
        // Read factor key from local storage.
        const metadata = this.tKey.getMetadata();
        const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
        const tKeyLocalStoreString = this.currentStorage.get<string>(tkeyPubX);
        const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}") as TkeyLocalStoreData;

        if (!tKeyLocalStore.factorKey) {
          throw new Error("required more shares");
        }

        factorKey = new BN(tKeyLocalStore.factorKey, "hex");
      }

      // Provide factor key to tkey.
      const metadataShare = await this.checkIfFactorKeyValid(factorKey);
      await this.tKey.inputShareStoreSafe(metadataShare, true);

      // Finalize initialization.
      await this.tKey.reconstructKey();
      await this.finalizeTkey(factorKey);
    }
  }

  private async finalizeTkey(factorKey: BN) {
    // Read tss meta data.
    const tssNonce: number = (this.tKey.metadata.tssNonces || {})[this.tKey.tssTag];
    const { tssShare, tssIndex: tssShareIndex } = await this.tKey.getTSSShare(factorKey);
    const tssPubKeyPoint = this.tKey.getTSSPub();
    const tssPubKey = Buffer.from(
      `${tssPubKeyPoint.x.toString(16, FIELD_ELEMENT_HEX_LEN)}${tssPubKeyPoint.y.toString(16, FIELD_ELEMENT_HEX_LEN)}`,
      "hex"
    );

    // check if tssShare is required in the state
    this.updateState({ tssNonce, tssShare, tssShareIndex, tssPubKey, factorKey });

    // Store factor key in local storage.
    const metadata = this.tKey.getMetadata();
    // TODO: We should not store the same recovery factor into the local storage
    // This essentially can make the SDK 2/2 in the case of using a recovery factor to get into a new device
    // There is also a possibility of losing a share if we're deleting a factor key
    // Let's say we delete the device factor key from metadata, the recovery factor key will be deleted as well
    // Ideal flow according to me -> Check is the share index is 2 or 3
    // if 2, copy the TSS Share into a new factor key and store into the device
    // if 3, create a new TSS Share for index 2 and store corresponding factor key into device.
    const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    this.currentStorage.set(
      tkeyPubX,
      JSON.stringify({
        factorKey: factorKey.toString("hex"),
      } as TkeyLocalStoreData)
    );

    // Finalize setup.
    await this.tKey.syncLocalMetadataTransitions();
    await this.setupProvider();
    await this.createSession();
  }

  private checkTkey() {
    if (!this.tKey) {
      throw new Error("tkey not initialized, call init first!");
    }
  }

  private async rehydrateSession() {
    try {
      if (!this.tKey || !this.torusSp) {
        throw new Error("tkey not initialized, call init first!");
      }
      if (!this.sessionManager.sessionKey) return {};
      const result = await this.sessionManager.authorizeSession();
      const factorKey = new BN(result.factorKey, "hex");
      if (!factorKey) {
        throw new Error("Invalid factor key");
      }
      this.torusSp.postboxKey = new BN(result.oAuthKey, "hex");
      this.torusSp.verifierName = result.userInfo.aggregateVerifier || result.userInfo.verifier;
      this.torusSp.verifierId = result.userInfo.verifierId;
      this.torusSp.verifierType = result.userInfo.aggregateVerifier ? "aggregate" : "normal";
      const deviceShare = await this.checkIfFactorKeyValid(factorKey);
      await this.tKey.initialize({ neverInitializeNewKey: true });
      await this.tKey.inputShareStoreSafe(deviceShare, true);
      await this.tKey.reconstructKey();

      this.updateState({
        factorKey: new BN(result.factorKey, "hex"),
        oAuthKey: result.oAuthKey,
        tssNonce: result.tssNonce,
        tssShare: new BN(result.tssShare, "hex"),
        tssShareIndex: result.tssShareIndex,
        tssPubKey: Buffer.from(result.tssPubKey.padStart(FIELD_ELEMENT_HEX_LEN, "0"), "hex"),
        signatures: result.signatures,
        userInfo: result.userInfo,
      });
    } catch (err) {
      log.error("error trying to authorize session", err);
    }
  }

  private async createSession() {
    try {
      const sessionId = OpenloginSessionManager.generateRandomSessionKey();
      this.sessionManager.sessionKey = sessionId;
      const { oAuthKey, factorKey, userInfo, tssNonce, tssShare, tssShareIndex, tssPubKey } = this.state;
      if (!oAuthKey || !factorKey || !tssShare || !tssPubKey || !userInfo) {
        throw new Error("User not logged in");
      }
      const payload: SessionData = {
        oAuthKey,
        factorKey: factorKey?.toString("hex"),
        tssNonce: tssNonce as number,
        tssShareIndex: tssShareIndex as number,
        tssShare: tssShare.toString("hex"),
        tssPubKey: Buffer.from(tssPubKey).toString("hex"),
        signatures: this.signatures,
        userInfo,
      };
      await this.sessionManager.createSession(payload);
      this.currentStorage.set("sessionId", sessionId);
    } catch (err) {
      log.error("error creating session", err);
    }
  }

  private async isMetadataPresent(privateKey: string) {
    const privateKeyBN = new BN(privateKey, "hex");
    const metadata = await this.tKey?.storageLayer.getMetadata<{ message: string }>({ privKey: privateKeyBN });
    if (metadata && Object.keys(metadata).length > 0 && metadata.message !== "KEY_NOT_FOUND") {
      return true;
    }
    return false;
  }

  private async checkIfFactorKeyValid(factorKey: BN): Promise<ShareStore> {
    this.checkTkey();
    const factorKeyMetadata = await this.tKey?.storageLayer.getMetadata<{ message: string }>({ privKey: factorKey });
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND") {
      throw new Error("no metadata for your factor key, reset your account");
    }
    const metadataShare = JSON.parse(factorKeyMetadata.message);
    if (!metadataShare.share) throw new Error("Invalid data from metadata");
    return metadataShare.share;
  }

  /**
   * Copies a share and makes it available under a new factor key. If no share
   * exists at the specified share index, a new share is created.
   * @param newFactorTSSIndex - The index of the share to copy.
   * @param newFactorPub - The public key of the new share.
   */
  private async copyOrCreateShare(newFactorTSSIndex: number, newFactorPub: TkeyPoint) {
    this.checkTkey();
    if (!this.tKey.metadata.factorPubs || !Array.isArray(this.tKey.metadata.factorPubs[this.tKey.tssTag])) {
      throw new Error("factorPubs does not exist, failed in copy factor pub");
    }
    if (!this.tKey.metadata.factorEncs || typeof this.tKey.metadata.factorEncs[this.tKey.tssTag] !== "object") {
      throw new Error("factorEncs does not exist, failed in copy factor pub");
    }
    if (!this.state.tssShareIndex || !this.state.tssShare) {
      throw new Error("tssShareIndex or tssShare not present");
    }
    if (VALID_SHARE_INDICES.indexOf(newFactorTSSIndex) === -1) {
      throw new Error(`invalid new share index: must be one of ${VALID_SHARE_INDICES}`);
    }

    if (this.tKey.metadata.factorPubs[this.tKey.tssTag].length >= MAX_FACTORS) {
      throw new Error("Maximum number of factors reached");
    }
    if (this.state.tssShareIndex !== newFactorTSSIndex) {
      if (!this.state.factorKey) throw new Error("factorKey not present");

      // Generate new share.
      await addFactorAndRefresh(this.tKey, newFactorPub, newFactorTSSIndex, this.state.factorKey, this.signatures);

      // Update local share.
      // TODO remove local tss share from state? could go out of sync with remote share.
      const { tssShare, tssIndex } = await this.tKey.getTSSShare(this.state.factorKey);
      this.updateState({
        tssShare,
        tssShareIndex: tssIndex,
      });
      return;
    }

    if (!this.state.factorKey) throw new Error("factorKey not present");
    const { tssShare } = await this.tKey.getTSSShare(this.state.factorKey);
    const updatedFactorPubs = this.tKey.metadata.factorPubs[this.tKey.tssTag].concat([newFactorPub]);
    const factorEncs = JSON.parse(JSON.stringify(this.tKey.metadata.factorEncs[this.tKey.tssTag]));
    const factorPubID = newFactorPub.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    factorEncs[factorPubID] = {
      tssIndex: this.state.tssShareIndex,
      type: "direct",
      userEnc: await encrypt(Point.fromTkeyPoint(newFactorPub).toBufferSEC1(false), Buffer.from(tssShare.toString(16, SCALAR_HEX_LEN), "hex")),
      serverEncs: [],
    };
    this.tKey.metadata.addTSSData({
      tssTag: this.tKey.tssTag,
      factorPubs: updatedFactorPubs,
      factorEncs,
    });
    await this.tkey?._syncShareMetadata();
  }

  private async getMetadataShare(): Promise<ShareStore> {
    try {
      const polyId = this.tKey?.metadata.getLatestPublicPolynomial().getPolynomialID();
      const shares = this.tKey?.shares[polyId];
      let share: ShareStore | null = null;

      for (const shareIndex in shares) {
        if (shareIndex !== SOCIAL_TKEY_INDEX.toString()) {
          share = shares[shareIndex];
        }
      }
      if (!share) throw new Error("no metadata share found");
      return share;
    } catch (err: unknown) {
      log.error("create device share error", err);
      throw new Error((err as Error).message);
    }
  }

  private async backupShareWithFactorKey(factorKey: BN) {
    const metadataShare = await this.getMetadataShare();
    const metadataToSet: FactorKeyCloudMetadata = {
      share: metadataShare,
    };

    // Set metadata for factor key backup
    await this.tKey?.addLocalMetadataTransitions({
      input: [{ message: JSON.stringify(metadataToSet) }],
      privKey: [factorKey],
    });
  }

  private async addFactorDescription(
    factorKey: BN,
    shareDescription: FactorKeyTypeShareDescription,
    additionalMetadata: Record<string, string> | null = null
  ) {
    const { tssIndex } = await this.tKey.getTSSShare(factorKey);
    const factorPub = getPubKeyECC(factorKey).toString("hex");
    const params = {
      module: shareDescription,
      dateAdded: Date.now(),
      ...additionalMetadata,
      tssShareIndex: tssIndex,
    };
    await this.tKey?.addShareDescription(factorPub, JSON.stringify(params), true);
  }

  private async setupProvider(): Promise<void> {
    const signingProvider = new EthereumSigningProvider({ config: { chainConfig: this.options.chainConfig } });
    const { tssNonce, tssShare, tssShareIndex, tssPubKey, tssNodeEndpoints } = this.state;

    if (!tssPubKey || !tssNodeEndpoints) {
      throw new Error("tssPubKey or tssNodeEndpoints not available");
    }

    const vid = `${this.verifier}${DELIMITERS.Delimiter1}${this.verifierId}`;
    const sessionId = `${vid}${DELIMITERS.Delimiter2}default${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}`;

    const sign = async (msgHash: Buffer) => {
      const parties = 4;
      const clientIndex = parties - 1;
      const tss = await import("@toruslabs/tss-lib");
      // 1. setup
      // generate endpoints for servers
      const { endpoints, tssWSEndpoints, partyIndexes } = generateTSSEndpoints(tssNodeEndpoints, parties, clientIndex);
      const randomSessionNonce = keccak256(Buffer.from(generatePrivate().toString("hex") + Date.now(), "utf8")).toString("hex");
      const tssImportUrl = `${tssNodeEndpoints[0]}/v1/clientWasm`;
      // session is needed for authentication to the web3auth infrastructure holding the factor 1
      const currentSession = `${sessionId}${randomSessionNonce}`;

      // setup mock shares, sockets and tss wasm files.
      const [sockets] = await Promise.all([tssUtils.setupSockets(tssWSEndpoints, randomSessionNonce), tss.default(tssImportUrl)]);

      const participatingServerDKGIndexes = [1, 2, 3];
      const dklsCoeff = tssUtils.getDKLSCoeff(true, participatingServerDKGIndexes, tssShareIndex as number);
      const denormalisedShare = dklsCoeff.mul(tssShare as BN).umod(CURVE.curve.n);
      const share = Buffer.from(denormalisedShare.toString(16, SCALAR_HEX_LEN), "hex").toString("base64");

      if (!currentSession) {
        throw new Error(`sessionAuth does not exist ${currentSession}`);
      }

      if (!this.signatures) {
        throw new Error(`Signature does not exist ${this.signatures}`);
      }

      const client = new Client(
        currentSession,
        clientIndex,
        partyIndexes,
        endpoints,
        sockets,
        share,
        tssPubKey.toString("base64"),
        true,
        tssImportUrl
      );
      const serverCoeffs: Record<number, string> = {};
      for (let i = 0; i < participatingServerDKGIndexes.length; i++) {
        const serverIndex = participatingServerDKGIndexes[i];
        serverCoeffs[serverIndex] = tssUtils.getDKLSCoeff(false, participatingServerDKGIndexes, tssShareIndex as number, serverIndex).toString("hex");
      }
      client.precompute(tss, { signatures: this.signatures, server_coeffs: serverCoeffs });
      await client.ready();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { r, s, recoveryParam } = await client.sign(tss as any, Buffer.from(msgHash).toString("base64"), true, "", "keccak256", {
        signatures: this.signatures,
      });
      await client.cleanup(tss, { signatures: this.signatures, server_coeffs: serverCoeffs });
      return { v: recoveryParam, r: r.toArrayLike(Buffer, "be", SCALAR_HEX_LEN), s: s.toArrayLike(Buffer, "be", SCALAR_HEX_LEN) };
    };

    const getPublic: () => Promise<Buffer> = async () => {
      return tssPubKey;
    };

    await signingProvider.setupProvider({ sign, getPublic });
    this.privKeyProvider = signingProvider;
  }

  private updateState(newState: Partial<Web3AuthState>): void {
    this.state = { ...this.state, ...newState };
  }

  private resetState(): void {
    this.state = {
      tssNodeEndpoints: this.state.tssNodeEndpoints,
    };
  }

  private _getOAuthKey(result: TorusKey): string {
    return TorusUtils.getPostboxKey(result);
  }

  private _getSignatures(sessionData: TorusKey["sessionData"]["sessionTokenData"]): string[] {
    return sessionData.map((session) => JSON.stringify({ data: session.token, sig: session.signature }));
  }
}
