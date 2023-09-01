import { encrypt, getPubKeyECC, getPubKeyPoint, KeyDetails, Point, ShareStore } from "@tkey-mpc/common-types";
import ThresholdKey, { CoreError } from "@tkey-mpc/core";
import { TorusServiceProvider } from "@tkey-mpc/service-provider-torus";
import { ShareSerializationModule } from "@tkey-mpc/share-serialization";
import { TorusStorageLayer } from "@tkey-mpc/storage-layer-torus";
import {
  AGGREGATE_VERIFIER,
  AGGREGATE_VERIFIER_TYPE,
  TORUS_METHOD,
  TorusAggregateLoginResponse,
  TorusLoginResponse,
  UX_MODE,
} from "@toruslabs/customauth";
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
  SCALAR_HEX_LEN,
  ShareType,
  VALID_SHARE_INDICES,
  WEB3AUTH_NETWORK,
} from "./constants";
import {
  AggregateVerifierLoginParams,
  FactorKeyCloudMetadata,
  IWeb3Auth,
  LoginParams,
  SessionData,
  SubVerifierDetailsParams,
  TkeyLocalStoreData,
  UserInfo,
  Web3AuthOptions,
  Web3AuthState,
} from "./interfaces";
import { addFactorAndRefresh, deleteFactorAndRefresh, encodePointSEC1, generateTSSEndpoints } from "./utils";

export class Web3AuthMPCCoreKit implements IWeb3Auth {
  private options: Web3AuthOptions;

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
    this.options = options;

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
    return this.tkey;
  }

  private get verifier(): string {
    if (this.state.userInfo.aggregateVerifier) {
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

  public async login(params: LoginParams, factorKey: BN | undefined = undefined): Promise<SafeEventEmitterProvider | null> {
    if (!this.tkey) {
      await this.init();
    }

    try {
      // oAuth login.
      if ((params as SubVerifierDetailsParams).subVerifierDetails) {
        // single verifier login.
        const loginResponse = await (this.tkey?.serviceProvider as TorusServiceProvider).triggerLogin(
          (params as SubVerifierDetailsParams).subVerifierDetails
        );

        if (this.isRedirectMode) return null;

        this.updateState({
          oAuthKey: this._getOAuthKey(loginResponse),
          userInfo: loginResponse.userInfo,
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
      } else if ((params as AggregateVerifierLoginParams).subVerifierDetailsArray) {
        if (
          (params as AggregateVerifierLoginParams).aggregateVerifierType === AGGREGATE_VERIFIER.SINGLE_VERIFIER_ID &&
          (params as AggregateVerifierLoginParams).subVerifierDetailsArray.length !== 1
        ) {
          throw new Error("Single id verifier must have exactly one sub verifier");
        }
        const loginResponse = await (this.tkey?.serviceProvider as TorusServiceProvider).triggerAggregateLogin({
          aggregateVerifierType: (params as AggregateVerifierLoginParams).aggregateVerifierType as AGGREGATE_VERIFIER_TYPE,
          verifierIdentifier: (params as AggregateVerifierLoginParams).aggregateVerifierIdentifier as string,
          subVerifierDetailsArray: (params as AggregateVerifierLoginParams).subVerifierDetailsArray,
        });

        if (this.isRedirectMode) return null;

        this.updateState({
          oAuthKey: this._getOAuthKey(loginResponse),
          userInfo: loginResponse.userInfo[0],
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
      }

      await this.setupTkey(factorKey);
      return this.provider;
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error((err as Error).message);
    }
  }

  // TODO Edited, but not tested. Need to test before enabling it!
  public async handleRedirectResult(factorKey: BN | undefined = undefined): Promise<SafeEventEmitterProvider> {
    const tested = false;
    if (!tested) {
      throw new Error("This function is not tested yet. Please test before enabling it!");
    }

    if (!this.tkey || !this.torusSp) {
      throw new Error("tkey is not initialized, call initi first");
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
        this.torusSp.verifierName = this.state.userInfo.verifier;
      } else if (result.method === TORUS_METHOD.TRIGGER_AGGREGATE_LOGIN) {
        const data = result.result as TorusAggregateLoginResponse;
        if (!data) throw new Error("Invalid login params passed");
        this.updateState({
          oAuthKey: this._getOAuthKey(data),
          userInfo: data.userInfo[0],
          signatures: this._getSignatures(data.sessionData.sessionTokenData),
        });
        this.torusSp.verifierType = "aggregate";
        this.torusSp.verifierName = this.state.userInfo.aggregateVerifier;
      } else {
        throw new Error("Unsupported method type");
      }

      this.torusSp.postboxKey = new BN(this.state.oAuthKey, "hex");
      this.torusSp.verifierId = this.state.userInfo.verifierId;
      await this.setupTkey(factorKey);
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
    return this.provider;
  }

  public async createFactor(
    factorKey: BN,
    shareType: ShareType | undefined = undefined,
    shareDescription: FactorKeyTypeShareDescription = FactorKeyTypeShareDescription.Other,
    additionalMetadata: Record<string, string> = {}
  ): Promise<void> {
    this.checkTkey();

    if (!shareType) {
      if (!this.state.tssShareIndex) {
        throw new Error("tss share index not present");
      }
      shareType = this.state.tssShareIndex;
    }

    try {
      const factorPub = getPubKeyPoint(factorKey);
      await this.copyOrCreateShare(shareType, factorPub);
      await this.addFactorDescription(factorKey, shareDescription, additionalMetadata);
      if (!this.options.manualSync) await this.tkey.syncLocalMetadataTransitions();
    } catch (error) {
      log.error("error creating factor", error);
      throw error;
    }
  }

  async deleteFactor(factorPub: Point): Promise<void> {
    await deleteFactorAndRefresh(this.tkey, factorPub, this.state.factorKey, this.signatures);
    const factorPubHex = encodePointSEC1(factorPub).toString("hex");
    const allDesc = this.tkey.metadata.getShareDescription();
    const keyDesc = allDesc[factorPubHex];
    if (keyDesc) {
      keyDesc.forEach(async (desc) => {
        await this.tkey?.deleteShareDescription(factorPubHex, desc, true);
      });
    }
    // TODO any other metadata we need to update? e.g. metadata transitions?
  }

  generateFactorKey(): BN {
    const factorKey = new BN(generatePrivate());
    return factorKey;
  }

  public getUserInfo(): UserInfo {
    if (!this.state.userInfo) {
      throw new Error("user is not logged in.");
    }
    return this.state.userInfo;
  }

  public getKeyDetails(): KeyDetails & { tssIndex: number } {
    this.checkTkey();
    const keyDetails = this.tkey.getKeyDetails();
    keyDetails.shareDescriptions = this.tkey.getMetadata().getShareDescription();
    return { ...keyDetails, tssIndex: this.state.tssShareIndex };
  }

  public async commitChanges(): Promise<void> {
    this.checkTkey();
    if (!this.state.factorKey) {
      throw new Error("factorKey not present.");
    }
    try {
      await this.tkey.syncLocalMetadataTransitions();
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

  public async CRITICAL_resetAccount(): Promise<void> {
    this.checkTkey();

    if (!this.state.oAuthKey) {
      throw new Error("user not logged in");
    }
    await this.tkey.storageLayer.setMetadata({
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

    // TODO works unreliably with `init({skipSw: true, skipPrefetch})`. Need to fix service provider?
    await (this.tkey.serviceProvider as TorusServiceProvider).init({});
    this.updateState({ tssNodeEndpoints: nodeDetails.torusNodeTSSEndpoints });
  }

  private async setupTkey(factorKey: BN | undefined = undefined): Promise<void> {
    const existingUser = await this.isMetadataPresent(this.state.oAuthKey as string);

    if (!existingUser) {
      // Generate new factor key if not provided.
      if (!factorKey) {
        factorKey = new BN(generatePrivate());
      }

      // Generate and device share and initialize tkey with it.
      const deviceTSSShare = new BN(generatePrivate());
      const deviceTSSIndex = ShareType.DEVICE;
      const factorPub = getPubKeyPoint(factorKey);
      await this.tkey.initialize({ useTSS: true, factorPub, deviceTSSShare, deviceTSSIndex });

      // Finalize initialization.
      await this.tkey.reconstructKey();
      await this.finalizeTkey(factorKey);

      // Store factor description.
      await this.addFactorDescription(factorKey, FactorKeyTypeShareDescription.DeviceShare);
    } else {
      // Initialize tkey with existing share.
      await this.tkey.initialize({ neverInitializeNewKey: true });

      if (!factorKey) {
        // Read factor key from local storage.
        const metadata = this.tkey.getMetadata();
        const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
        const tKeyLocalStoreString = this.currentStorage.get<string>(tkeyPubX);
        const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}") as TkeyLocalStoreData;

        if (!tKeyLocalStore.factorKey) {
          throw new Error("factor key not present in local storage");
        }

        factorKey = new BN(tKeyLocalStore.factorKey, "hex");
      }

      // Provide factor key to tkey.
      const metadataShare = await this.checkIfFactorKeyValid(factorKey);
      await this.tkey.inputShareStoreSafe(metadataShare, true);

      // Finalize initialization.
      await this.tkey.reconstructKey();
      await this.finalizeTkey(factorKey);
    }
  }

  private async finalizeTkey(factorKey: BN) {
    // Ensure sufficiently many shares are present.
    const { requiredShares } = this.tkey.getKeyDetails();
    if (requiredShares > 0) {
      throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
    }

    // Read tss meta data.
    const tssNonce: number = (this.tkey.metadata.tssNonces || {})[this.tkey.tssTag];
    const { tssShare, tssIndex: tssShareIndex } = await this.tkey.getTSSShare(factorKey);
    const tssPubKeyPoint = this.tkey.getTSSPub();
    const tssPubKey = Buffer.from(
      `${tssPubKeyPoint.x.toString(16, FIELD_ELEMENT_HEX_LEN)}${tssPubKeyPoint.y.toString(16, FIELD_ELEMENT_HEX_LEN)}`,
      "hex"
    );
    this.updateState({ tssNonce, tssShare, tssShareIndex, tssPubKey, factorKey });

    // Store factor key in local storage.
    const metadata = this.tkey.getMetadata();
    const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    this.currentStorage.set(
      tkeyPubX,
      JSON.stringify({
        factorKey: factorKey.toString("hex"),
      } as TkeyLocalStoreData)
    );

    // Finalize setup.
    await this.tkey.syncLocalMetadataTransitions();
    await this.setupProvider();
    await this.createSession();
  }

  private checkTkey() {
    if (!this.tkey) {
      throw new Error("tkey not initialized, call init first!");
    }
  }

  private async rehydrateSession() {
    try {
      if (!this.tkey || !this.torusSp) {
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
      // TODO do we need to set verifierType?
      const deviceShare = await this.checkIfFactorKeyValid(factorKey);
      await this.tkey.initialize({ neverInitializeNewKey: true });
      await this.tkey.inputShareStoreSafe(deviceShare, true);
      await this.tkey.reconstructKey();

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
    const metadata = await this.tkey?.storageLayer.getMetadata<{ message: string }>({ privKey: privateKeyBN });
    if (metadata && Object.keys(metadata).length > 0 && metadata.message !== "KEY_NOT_FOUND") {
      return true;
    }
    return false;
  }

  private async checkIfFactorKeyValid(factorKey: BN): Promise<ShareStore> {
    this.checkTkey();
    const factorKeyMetadata = await this.tkey?.storageLayer.getMetadata<{ message: string }>({ privKey: factorKey });
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND") {
      throw new Error("no metadata for your factor key, reset your account");
    }
    const metadataShare = JSON.parse(factorKeyMetadata.message);
    if (!metadataShare.share || !metadataShare.tssShare) throw new Error("Invalid data from metadata");
    return metadataShare.share;
  }

  /**
   * Copies a share and makes it available under a new factor key. If no share
   * exists at the specified share index, a new share is created.
   * @param newFactorTSSIndex - The index of the share to copy.
   * @param newFactorPub - The public key of the new share.
   */
  private async copyOrCreateShare(newFactorTSSIndex: number, newFactorPub: Point) {
    this.checkTkey();
    if (!this.tkey.metadata.factorPubs || !Array.isArray(this.tkey.metadata.factorPubs[this.tkey.tssTag])) {
      throw new Error("factorPubs does not exist, failed in copy factor pub");
    }
    if (!this.tkey.metadata.factorEncs || typeof this.tkey.metadata.factorEncs[this.tkey.tssTag] !== "object") {
      throw new Error("factorEncs does not exist, failed in copy factor pub");
    }
    if (!this.state.tssShareIndex || !this.state.tssShare) {
      throw new Error("tssShareIndex or tssShare not present");
    }
    if (VALID_SHARE_INDICES.indexOf(newFactorTSSIndex) === -1) {
      throw new Error(`invalid new share index: must be one of ${VALID_SHARE_INDICES}`);
    }

    // TODO Should we set a limit on the number of copies per share?
    if (this.state.tssShareIndex !== newFactorTSSIndex) {
      // Generate new share.
      //
      // TODO There is a function tKey.generateNewShare which does almost the
      // same, but fails when called repeatedly (may be buggy). Ideally, revise
      // tkey function and use that instead?
      await addFactorAndRefresh(this.tkey, newFactorPub, newFactorTSSIndex, this.state.factorKey, this.signatures);

      // Update local share.
      // TODO remove local tss share from state? could go out of sync with remote share.
      const { tssShare, tssIndex } = await this.tkey.getTSSShare(this.state.factorKey);
      this.updateState({
        tssShare,
        tssShareIndex: tssIndex,
      });
      return;
    }

    const updatedFactorPubs = this.tkey.metadata.factorPubs[this.tkey.tssTag].concat([newFactorPub]);
    const factorEncs = JSON.parse(JSON.stringify(this.tkey.metadata.factorEncs[this.tkey.tssTag]));
    const factorPubID = newFactorPub.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    factorEncs[factorPubID] = {
      tssIndex: this.state.tssShareIndex,
      type: "direct",
      userEnc: await encrypt(encodePointSEC1(newFactorPub), Buffer.from(this.state.tssShare.toString(16, SCALAR_HEX_LEN), "hex")),
      serverEncs: [],
    };
    this.tkey.metadata.addTSSData({
      tssTag: this.tkey.tssTag,
      factorPubs: updatedFactorPubs,
      factorEncs,
    });
  }

  // TODO same function exists in tkey, should be exported and used from there.
  private async getMetadataShare(): Promise<ShareStore> {
    try {
      const polyId = this.tkey?.metadata.getLatestPublicPolynomial().getPolynomialID();
      const shares = this.tkey?.shares[polyId];
      let share: ShareStore | null = null;

      for (const shareIndex in shares) {
        // TODO check what this is doing. why != "1"?
        if (shareIndex !== "1") {
          share = shares[shareIndex];
        }
      }
      return share;
    } catch (err: unknown) {
      log.error("create device share error", err);
      throw new Error((err as Error).message);
    }
  }

  // TODO use addFactorKeyMetadata from tkey instead?
  private async addFactorDescription(
    factorKey: BN,
    shareDescription: FactorKeyTypeShareDescription,
    additionalMetadata: Record<string, string> | null = null
  ) {
    const { tssShare, tssIndex } = await this.tkey.getTSSShare(factorKey);

    const metadataShare = await this.getMetadataShare();
    const factorPub = getPubKeyECC(factorKey).toString("hex");
    const metadataToSet: FactorKeyCloudMetadata = {
      share: metadataShare,
      tssShare,
      tssIndex,
    };

    // Set metadata for factor key backup
    await this.tkey?.addLocalMetadataTransitions({
      input: [{ message: JSON.stringify(metadataToSet) }],
      privKey: [factorKey],
    });
    const params = {
      module: shareDescription,
      dateAdded: Date.now(),
      ...additionalMetadata,
      tssShareIndex: tssIndex,
    };
    await this.tkey?.addShareDescription(factorPub, JSON.stringify(params), true);
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
