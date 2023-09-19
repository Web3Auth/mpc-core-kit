/* eslint-disable @typescript-eslint/member-ordering */
import {
  BNString,
  encrypt,
  getPubKeyPoint,
  KeyDetails,
  Point as TkeyPoint,
  SHARE_DELETED,
  ShareStore,
  StringifiedType,
} from "@tkey-mpc/common-types";
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
  TssShareType,
  VALID_SHARE_INDICES,
  WEB3AUTH_NETWORK,
} from "./constants";
import { BrowserStorage } from "./helper/browserStorage";
import {
  AggregateVerifierLoginParams,
  COREKIT_STATUS,
  CreateFactorParams,
  ICoreKit,
  IdTokenLoginParams,
  IFactorKey,
  OauthLoginParams,
  SessionData,
  SubVerifierDetailsParams,
  UserInfo,
  Web3AuthOptions,
  Web3AuthOptionsWithDefaults,
  Web3AuthState,
} from "./interfaces";
import { Point } from "./point";
import { addFactorAndRefresh, deleteFactorAndRefresh, generateFactorKey, generateTSSEndpoints, parseToken } from "./utils";

export class Web3AuthMPCCoreKit implements ICoreKit {
  public state: Web3AuthState = {};

  private options: Web3AuthOptionsWithDefaults;

  private privKeyProvider: EthereumSigningProvider | null = null;

  private torusSp: TorusServiceProvider | null = null;

  private storageLayer: TorusStorageLayer | null = null;

  private tkey: ThresholdKey | null = null;

  private sessionManager!: OpenloginSessionManager<SessionData>;

  private currentStorage!: BrowserStorage;

  private nodeDetailManager!: NodeDetailManager;

  private _storageBaseKey = "corekit_store";

  private enableLogging = false;

  private ready = false;

  private authLoggedIn = false;

  constructor(options: Web3AuthOptions) {
    if (!options.chainConfig) options.chainConfig = DEFAULT_CHAIN_CONFIG;
    if (options.chainConfig.chainNamespace !== CHAIN_NAMESPACES.EIP155) {
      throw new Error("You must specify a eip155 chain config.");
    }
    if (!options.web3AuthClientId) {
      throw new Error("You must specify a web3auth clientId.");
    }

    if (options.enableLogging) {
      log.enableAll();
      this.enableLogging = true;
    } else log.setLevel("error");
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
      enableLogging: options.enableLogging,
    });
  }

  get tKey(): ThresholdKey {
    if (this.tkey === null) throw new Error("Tkey not initialized");
    return this.tkey;
  }

  get provider(): SafeEventEmitterProvider | null {
    return this.privKeyProvider?.provider ? this.privKeyProvider.provider : null;
  }

  set provider(_: SafeEventEmitterProvider | null) {
    throw new Error("Not implemented");
  }

  get signatures(): string[] {
    return this.state?.signatures ? this.state.signatures : [];
  }

  set signatures(_: string[] | null) {
    throw new Error("Not implemented");
  }

  get metadataKey(): string | null {
    return this.state?.oAuthKey ? this.state.oAuthKey : null;
  }

  set metadataKey(_: string | null) {
    throw new Error("Not implemented");
  }

  get status(): COREKIT_STATUS {
    if (this.authLoggedIn) {
      if (!this.tkey.privKey) return COREKIT_STATUS.REQUIRED_SHARE;
      if (!this.state.factorKey) return COREKIT_STATUS.REQUIRED_SHARE;
      return COREKIT_STATUS.LOGGED_IN;
    }
    if (this.ready) return COREKIT_STATUS.INITIALIZED;
    return COREKIT_STATUS.NOT_INITIALIZED;
  }

  get sessionId(): string {
    return this.sessionManager.sessionId;
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

  private get isRedirectMode(): boolean {
    return this.options.uxMode === UX_MODE.REDIRECT;
  }

  public async init(): Promise<void> {
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
        redirectPathName: this.options.redirectPathName,
        locationReplaceOnRedirect: true,
      },
      nodeEndpoints: nodeDetails.torusNodeEndpoints,
      nodePubKeys: nodeDetails.torusNodePub.map((i) => ({ x: i.X, y: i.Y })),
    });

    this.storageLayer = new TorusStorageLayer({
      hostUrl: `${new URL(nodeDetails.torusNodeEndpoints[0]).origin}/metadata`,
      enableLogging: this.enableLogging,
    });

    const shareSerializationModule = new ShareSerializationModule();

    this.tkey = new ThresholdKey({
      enableLogging: this.enableLogging,
      serviceProvider: this.torusSp,
      storageLayer: this.storageLayer,
      manualSync: this.options.manualSync,
      modules: {
        shareSerialization: shareSerializationModule,
      },
    });

    if (this.isRedirectMode) {
      await (this.tKey.serviceProvider as TorusServiceProvider).init({ skipSw: true, skipPrefetch: true });
    } else {
      await (this.tKey.serviceProvider as TorusServiceProvider).init({});
    }

    this.ready = true;

    if (this.sessionManager.sessionId) {
      await this.rehydrateSession();
      if (this.state.factorKey) await this.setupProvider();
    }
  }

  public async loginWithOauth(params: OauthLoginParams): Promise<void> {
    this.checkReady();

    const tkeyServiceProvider = this.tKey.serviceProvider as TorusServiceProvider;
    try {
      // oAuth login.
      const verifierParams = params as SubVerifierDetailsParams;
      const aggregateParams = params as AggregateVerifierLoginParams;
      if (verifierParams.subVerifierDetails) {
        // single verifier login.
        const loginResponse = await tkeyServiceProvider.triggerLogin((params as SubVerifierDetailsParams).subVerifierDetails);

        if (this.isRedirectMode) return;

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

        if (this.isRedirectMode) return;

        this.updateState({
          oAuthKey: this._getOAuthKey(loginResponse),
          userInfo: loginResponse.userInfo[0],
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
      }

      await this.setupTkey();
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error((err as Error).message);
    }
  }

  public async loginWithJWT(idTokenLoginParams: IdTokenLoginParams): Promise<void> {
    this.checkReady();

    const { verifier, verifierId, idToken } = idTokenLoginParams;
    try {
      // oAuth login.
      let loginResponse: TorusKey;
      if (!idTokenLoginParams.subVerifier) {
        // single verifier login.
        loginResponse = await (this.tKey.serviceProvider as TorusServiceProvider).directWeb.getTorusKey(
          verifier,
          verifierId,
          { verifier_id: verifierId },
          idToken,
          {
            ...idTokenLoginParams.extraVerifierParams,
            ...idTokenLoginParams.additionalParams,
          }
        );
        (this.tKey.serviceProvider as TorusServiceProvider).verifierType = "normal";
      } else {
        // aggregate verifier login
        loginResponse = await (this.tKey.serviceProvider as TorusServiceProvider).directWeb.getAggregateTorusKey(verifier, verifierId, [
          { verifier: idTokenLoginParams.subVerifier, idToken, extraVerifierParams: idTokenLoginParams.extraVerifierParams },
        ]);
        (this.tKey.serviceProvider as TorusServiceProvider).verifierType = "aggregate";
      }

      const oAuthShare = this._getOAuthKey(loginResponse);

      (this.tKey.serviceProvider as TorusServiceProvider).postboxKey = new BN(oAuthShare, "hex");
      (this.tKey.serviceProvider as TorusServiceProvider).verifierName = verifier;
      (this.tKey.serviceProvider as TorusServiceProvider).verifierId = verifierId;

      this.updateState({
        oAuthKey: oAuthShare,
        userInfo: { ...parseToken(idToken), verifier, verifierId },
        signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
      });

      await this.setupTkey();
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error((err as Error).message);
    }
  }

  public async handleRedirectResult(): Promise<void> {
    this.checkReady();

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
      await this.setupTkey();
    } catch (error: unknown) {
      log.error("error while handling redirect result", error);
      throw new Error((error as Error).message);
    }
  }

  public async inputFactorKey(factorKey: BN): Promise<void> {
    this.checkReady();
    try {
      const metadataShare = await this.checkIfFactorKeyValid(factorKey);
      await this.tKey.inputShareStoreSafe(metadataShare, true);

      // Finalize initialization.
      await this.tKey.reconstructKey();
      await this.finalizeTkey(factorKey);
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error((err as Error).message);
    }
  }

  public getCurrentFactorKey(): IFactorKey {
    this.checkReady();
    if (!this.state.factorKey) throw new Error("factorKey not present");
    if (!this.state.tssShareIndex) throw new Error("TSS Share Type (Index) not present");
    try {
      return {
        factorKey: this.state.factorKey,
        shareType: this.state.tssShareIndex,
      };
    } catch (err: unknown) {
      log.error("state error", err);
      throw new Error((err as Error).message);
    }
  }

  public async createFactor(createFactorParams: CreateFactorParams): Promise<string> {
    this.checkReady();

    let { shareType, factorKey, shareDescription, additionalMetadata } = createFactorParams;

    if (!VALID_SHARE_INDICES.includes(shareType)) {
      throw new Error(`invalid share type: must be one of ${VALID_SHARE_INDICES}`);
    }
    if (!factorKey) {
      factorKey = generateFactorKey().private;
    }
    if (!shareDescription) {
      shareDescription = FactorKeyTypeShareDescription.Other;
    }
    if (!additionalMetadata) {
      additionalMetadata = {};
    }

    try {
      const factorPub = getPubKeyPoint(factorKey);
      await this.copyOrCreateShare(shareType, factorPub);
      await this.backupShareWithFactorKey(factorKey);
      await this.addFactorDescription(factorKey, shareDescription, additionalMetadata);
      if (!this.options.manualSync) await this.tKey.syncLocalMetadataTransitions();
      return factorKey.toString("hex").padStart(64, "0");
    } catch (error) {
      log.error("error creating factor", error);
      throw error;
    }
  }

  async deleteFactor(factorPub: TkeyPoint, factorKey?: BNString): Promise<void> {
    if (!this.state.factorKey) throw new Error("Factor key not present");
    if (!this.tKey.metadata.factorPubs) throw new Error("Factor pubs not present");
    const remainingFactors = this.tKey.metadata.factorPubs[this.tKey.tssTag].length || 0;
    if (remainingFactors <= 1) throw new Error("Cannot delete last factor");
    if (
      Point.fromTkeyPoint(factorPub).toBufferSEC1(true).toString("hex") ===
      Point.fromTkeyPoint(getPubKeyPoint(this.state.factorKey)).toBufferSEC1(true).toString("hex")
    ) {
      throw new Error("Cannot delete current active factor");
    }

    await deleteFactorAndRefresh(this.tKey, factorPub, this.state.factorKey, this.signatures);
    const factorPubHex = Point.fromTkeyPoint(factorPub).toBufferSEC1(true).toString("hex");
    const allDesc = this.tKey.metadata.getShareDescription();
    const keyDesc = allDesc[factorPubHex];
    if (keyDesc) {
      keyDesc.forEach(async (desc) => {
        await this.tKey?.deleteShareDescription(factorPubHex, desc);
      });
    }

    // delete factorKey share metadata if factorkey is provided
    if (factorKey) {
      const factorKeyBN = new BN(factorKey, "hex");
      const derivedFactorPub = Point.fromTkeyPoint(getPubKeyPoint(factorKeyBN));
      // only delete if factorPub matches
      if (derivedFactorPub.toBufferSEC1(true).toString("hex") === factorPubHex) {
        await this.deleteShareWithFactorKey(factorKeyBN);
      }
    }

    if (!this.options.manualSync) await this.tKey.syncLocalMetadataTransitions();
  }

  public async logout(): Promise<void> {
    if (!this.sessionManager.sessionId) {
      throw new Error("User is not logged in.");
    }
    await this.sessionManager.invalidateSession();
    this.currentStorage.set("sessionId", "");
    this.resetState();
    await this.init();
  }

  public getUserInfo(): UserInfo {
    if (!this.state.userInfo) {
      throw new Error("user is not logged in.");
    }
    return this.state.userInfo;
  }

  public getKeyDetails(): KeyDetails & { tssPubKey?: TkeyPoint } {
    this.checkReady();
    const keyDetails = this.tKey.getKeyDetails();
    keyDetails.shareDescriptions = this.tKey.getMetadata().getShareDescription();
    // const tssPubKey = this.tKey.getTSSPub();
    return { ...keyDetails };
  }

  public async commitChanges(): Promise<void> {
    this.checkReady();
    if (!this.state.factorKey) throw new Error("factorKey not present");

    try {
      await this.tKey._syncShareMetadata();
      await this.tKey.syncLocalMetadataTransitions();
    } catch (error: unknown) {
      log.error("sync metadata error", error);
      throw error;
    }
  }

  public async importTssKey(tssKey: string, factorPub: TkeyPoint, newTSSIndex: TssShareType = TssShareType.DEVICE): Promise<void> {
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

  private getTssNonce(): number {
    if (!this.tKey.metadata.tssNonces) throw new Error("tssNonce not present");
    const tssNonce = this.tKey.metadata.tssNonces[this.tKey.tssTag];
    return tssNonce;
  }

  private async setupTkey(): Promise<void> {
    if (!this.state.oAuthKey) {
      throw new Error("user not logged in");
    }
    const existingUser = await this.isMetadataPresent(this.state.oAuthKey);
    let factorKey: BN;
    if (!existingUser) {
      // Generate new factor key if not provided.
      factorKey = new BN(generatePrivate());

      // Generate and device share and initialize tkey with it.
      const deviceTSSShare = new BN(generatePrivate());
      const deviceTSSIndex = TssShareType.DEVICE;
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
    }
    this.authLoggedIn = true;
  }

  private async finalizeTkey(factorKey: BN) {
    // Read tss meta data.
    const { tssIndex: tssShareIndex } = await this.tKey.getTSSShare(factorKey);
    const tssPubKeyPoint = this.tKey.getTSSPub();
    const tssPubKey = Buffer.from(
      `${tssPubKeyPoint.x.toString(16, FIELD_ELEMENT_HEX_LEN)}${tssPubKeyPoint.y.toString(16, FIELD_ELEMENT_HEX_LEN)}`,
      "hex"
    );

    this.updateState({ tssShareIndex, tssPubKey, factorKey });

    // Finalize setup.
    await this.tKey.syncLocalMetadataTransitions();
    await this.setupProvider();
    await this.createSession();
  }

  private checkReady() {
    if (!this.ready) {
      throw Error("MPC Core Kit not initialized, call init first!");
    }
  }

  private async rehydrateSession() {
    try {
      this.checkReady();

      if (!this.sessionManager.sessionId) return {};
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
      this.sessionManager.sessionId = sessionId;
      const { oAuthKey, factorKey, userInfo, tssShareIndex, tssPubKey } = this.state;
      if (!this.state.factorKey) throw new Error("factorKey not present");
      const { tssShare } = await this.tKey.getTSSShare(this.state.factorKey);
      if (!oAuthKey || !factorKey || !tssShare || !tssPubKey || !userInfo) {
        throw new Error("User not logged in");
      }
      const payload: SessionData = {
        oAuthKey,
        factorKey: factorKey?.toString("hex"),
        tssShareIndex: tssShareIndex as number,
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
    this.checkReady();
    const factorKeyMetadata = await this.tKey?.storageLayer.getMetadata<StringifiedType>({ privKey: factorKey });
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND") {
      throw new Error("no metadata for your factor key, reset your account");
    }
    return ShareStore.fromJSON(factorKeyMetadata);
  }

  /**
   * Copies a share and makes it available under a new factor key. If no share
   * exists at the specified share index, a new share is created.
   * @param newFactorTSSIndex - The index of the share to copy.
   * @param newFactorPub - The public key of the new share.
   */
  private async copyOrCreateShare(newFactorTSSIndex: number, newFactorPub: TkeyPoint) {
    this.checkReady();
    if (!this.tKey.metadata.factorPubs || !Array.isArray(this.tKey.metadata.factorPubs[this.tKey.tssTag])) {
      throw new Error("factorPubs does not exist, failed in copy factor pub");
    }
    if (!this.tKey.metadata.factorEncs || typeof this.tKey.metadata.factorEncs[this.tKey.tssTag] !== "object") {
      throw new Error("factorEncs does not exist, failed in copy factor pub");
    }
    if (!this.state.factorKey) {
      throw new Error("factorKey not present");
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
      const { tssIndex } = await this.tKey.getTSSShare(this.state.factorKey);
      this.updateState({
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

  private async deleteShareWithFactorKey(factorKey: BN): Promise<void> {
    await this.tKey.addLocalMetadataTransitions({ input: [{ message: SHARE_DELETED, dateAdded: Date.now() }], privKey: [factorKey] });
    if (!this.tkey?.manualSync) await this.tkey?.syncLocalMetadataTransitions();
  }

  private async backupShareWithFactorKey(factorKey: BN) {
    const metadataShare = await this.getMetadataShare();

    // Set metadata for factor key backup
    await this.tKey?.addLocalMetadataTransitions({
      input: [metadataShare],
      privKey: [factorKey],
    });
    if (!this.tkey?.manualSync) await this.tkey?.syncLocalMetadataTransitions();
  }

  private async addFactorDescription(
    factorKey: BN,
    shareDescription: FactorKeyTypeShareDescription,
    additionalMetadata: Record<string, string> = {}
  ) {
    const { tssIndex } = await this.tKey.getTSSShare(factorKey);
    const tkeyPoint = getPubKeyPoint(factorKey);
    const factorPub = Point.fromTkeyPoint(tkeyPoint).toBufferSEC1(true).toString("hex");
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
    const { tssShareIndex, tssPubKey } = this.state;
    const { torusNodeTSSEndpoints } = await this.nodeDetailManager.getNodeDetails({
      verifier: "test-verifier",
      verifierId: "test@example.com",
    });

    if (!this.state.factorKey) throw new Error("factorKey not present");
    const { tssShare } = await this.tKey.getTSSShare(this.state.factorKey);
    const tssNonce = this.getTssNonce();

    if (!tssPubKey || !torusNodeTSSEndpoints) {
      throw new Error("tssPubKey or torusNodeTSSEndpoints not available");
    }

    const vid = `${this.verifier}${DELIMITERS.Delimiter1}${this.verifierId}`;
    const sessionId = `${vid}${DELIMITERS.Delimiter2}default${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}`;

    const sign = async (msgHash: Buffer) => {
      const parties = 4;
      const clientIndex = parties - 1;
      const tss = await import("@toruslabs/tss-lib");
      // 1. setup
      // generate endpoints for servers
      const { endpoints, tssWSEndpoints, partyIndexes } = generateTSSEndpoints(torusNodeTSSEndpoints, parties, clientIndex);
      const randomSessionNonce = keccak256(Buffer.from(generatePrivate().toString("hex") + Date.now(), "utf8")).toString("hex");
      const tssImportUrl = `${torusNodeTSSEndpoints[0]}/v1/clientWasm`;
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
    this.tkey = null;
    this.privKeyProvider = null;
  }

  private _getOAuthKey(result: TorusKey): string {
    return TorusUtils.getPostboxKey(result);
  }

  private _getSignatures(sessionData: TorusKey["sessionData"]["sessionTokenData"]): string[] {
    return sessionData.map((session) => JSON.stringify({ data: session.token, sig: session.signature }));
  }
}
