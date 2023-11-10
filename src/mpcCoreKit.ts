/* eslint-disable @typescript-eslint/member-ordering */
import {
  BNString,
  encrypt,
  EncryptedMessage,
  getPubKeyPoint,
  Point as TkeyPoint,
  SHARE_DELETED,
  ShareStore,
  StringifiedType,
} from "@tkey-mpc/common-types";
import ThresholdKey, { CoreError, lagrangeInterpolation } from "@tkey-mpc/core";
import { TorusServiceProvider } from "@tkey-mpc/service-provider-torus";
import { ShareSerializationModule } from "@tkey-mpc/share-serialization";
import { TorusStorageLayer } from "@tkey-mpc/storage-layer-torus";
import { AGGREGATE_VERIFIER, TORUS_METHOD, TorusAggregateLoginResponse, TorusLoginResponse, UX_MODE } from "@toruslabs/customauth";
import { generatePrivate } from "@toruslabs/eccrypto";
import { NodeDetailManager } from "@toruslabs/fetch-node-details";
import { post } from "@toruslabs/http-helpers";
import { keccak256 } from "@toruslabs/metadata-helpers";
import { OpenloginSessionManager } from "@toruslabs/openlogin-session-manager";
import TorusUtils, { TorusKey } from "@toruslabs/torus.js";
import { Client, getDKLSCoeff, setupSockets } from "@toruslabs/tss-client";
import type * as TssLib from "@toruslabs/tss-lib";
import { CHAIN_NAMESPACES, log, SafeEventEmitterProvider } from "@web3auth/base";
import { EthereumSigningProvider } from "@web3auth-mpc/ethereum-provider";
import BN from "bn.js";
import bowser from "bowser";

// import { name, version } from "../package.json";
import {
  CURVE,
  DEFAULT_CHAIN_CONFIG,
  DELIMITERS,
  ERRORS,
  FactorKeyTypeShareDescription,
  FIELD_ELEMENT_HEX_LEN,
  MAX_FACTORS,
  SOCIAL_TKEY_INDEX,
  TssShareType,
  VALID_SHARE_INDICES,
  WEB3AUTH_NETWORK,
} from "./constants";
import { BrowserStorage, storeWebBrowserFactor } from "./helper/browserStorage";
import {
  AggregateVerifierLoginParams,
  COREKIT_STATUS,
  CreateFactorParams,
  EnableMFAParams,
  ICoreKit,
  IdTokenLoginParams,
  IFactorKey,
  InitParams,
  MPCKeyDetails,
  OauthLoginParams,
  SessionData,
  SubVerifierDetailsParams,
  UserInfo,
  Web3AuthOptions,
  Web3AuthOptionsWithDefaults,
  Web3AuthState,
} from "./interfaces";
import { Point } from "./point";
import {
  addFactorAndRefresh,
  deleteFactorAndRefresh,
  generateFactorKey,
  generateTSSEndpoints,
  getHashedPrivateKey,
  parseToken,
  scalarBNToBufferSEC1,
} from "./utils";

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

  constructor(options: Web3AuthOptions) {
    // log.info("======================================================");
    // log.info(`WEB3AUTH SDK : ${name}:${version}`);

    // log.info("======================================================");

    if (!options.chainConfig) options.chainConfig = DEFAULT_CHAIN_CONFIG;
    if (options.chainConfig.chainNamespace !== CHAIN_NAMESPACES.EIP155) {
      throw new Error("You must specify a eip155 chain config.");
    }
    if (!options.web3AuthClientId) {
      throw new Error("You must specify a web3auth clientId.");
    }
    if (options.uxMode === "nodejs" && ["local", "session"].includes(options.storageKey.toString())) {
      throw new Error(`nodejs mode do not storage of type : ${options.storageKey}`);
    }

    if (options.uxMode === "nodejs" && !options.tssLib) {
      throw new Error(`nodejs mode requires tssLib`);
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
    if (!options.redirectPathName) options.redirectPathName = "redirect";
    if (!options.baseUrl) options.baseUrl = `${window.location.origin}/serviceworker`;
    if (!options.disableHashedFactorKey) options.disableHashedFactorKey = false;
    if (!options.authorizationUrl) options.authorizationUrl = [];
    if (!options.allowNoAuthorizationForRemoteClient) options.allowNoAuthorizationForRemoteClient = false;

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
    try {
      // metadata will be present if tkey is initialized (1 share)
      // if 2 shares are present, then privKey will be present after metadatakey(tkey) reconstruction
      const { tkey } = this;
      if (!tkey) return COREKIT_STATUS.NOT_INITIALIZED;
      if (!tkey.metadata) return COREKIT_STATUS.INITIALIZED;
      if (!tkey.privKey || (!this.state.factorKey && !this.state.remoteClient)) return COREKIT_STATUS.REQUIRED_SHARE;
      return COREKIT_STATUS.LOGGED_IN;
    } catch (e) {}
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

  public async _UNSAFE_recoverTssKey(factorKey: string[]) {
    this.checkReady();
    const factorKeyBN = new BN(factorKey[0], "hex");

    const shareStore0 = await this.getFactorKeyMetadata(factorKeyBN);
    await this.tKey.initialize({ withShare: shareStore0 });

    this.tkey.privKey = new BN(factorKey[1], "hex");

    const tssShares: BN[] = [];
    const tssIndexes: number[] = [];
    const tssIndexesBN: BN[] = [];
    for (let i = 0; i < factorKey.length; i++) {
      const factorKeyBNInput = new BN(factorKey[i], "hex");
      const { tssIndex, tssShare } = await this.tKey.getTSSShare(factorKeyBNInput);
      if (tssIndexes.includes(tssIndex)) {
        await this.init();
        throw new Error("Duplicate TSS Index");
      }
      tssIndexes.push(tssIndex);
      tssIndexesBN.push(new BN(tssIndex));
      tssShares.push(tssShare);
    }

    const finalKey = lagrangeInterpolation(tssShares, tssIndexesBN);
    await this.init();
    return finalKey.toString("hex");
  }

  public async init(params: InitParams = { handleRedirectResult: true }): Promise<void> {
    this.resetState();

    const nodeDetails = await this.nodeDetailManager.getNodeDetails({ verifier: "test-verifier", verifierId: "test@example.com" });

    if (!nodeDetails) {
      throw new Error("error getting node details, please try again!");
    }

    this.torusSp = new TorusServiceProvider({
      useTSS: true,
      customAuthArgs: {
        web3AuthClientId: this.options.web3AuthClientId,
        baseUrl: this.options.baseUrl ? this.options.baseUrl : `${window.location.origin}/serviceworker`,
        uxMode: this.options.uxMode === "nodejs" ? UX_MODE.REDIRECT : this.options.uxMode,
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
    } else if (this.options.uxMode === UX_MODE.POPUP) {
      await (this.tKey.serviceProvider as TorusServiceProvider).init({});
    }
    this.ready = true;

    // try handle redirect flow if enabled and return(redirect) from oauth login
    if (
      params.handleRedirectResult &&
      this.options.uxMode === UX_MODE.REDIRECT &&
      (window?.location.hash.includes("#state") || window?.location.hash.includes("#access_token"))
    ) {
      await this.handleRedirectResult();

      // if not redirect flow try to rehydrate session if available
    } else if (this.sessionManager.sessionId) {
      await this.rehydrateSession();
      if (this.state.factorKey || this.state.remoteClient) await this.setupProvider();
    }
    // if not redirect flow or session rehydration, ask for factor key to login
  }

  public async loginWithOauth(params: OauthLoginParams, importTssKey?: string): Promise<void> {
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

      await this.setupTkey(importTssKey);
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error((err as Error).message);
    }
  }

  public async loginWithJWT(idTokenLoginParams: IdTokenLoginParams, importTssKey?: string): Promise<void> {
    this.checkReady();

    const { verifier, verifierId, idToken } = idTokenLoginParams;
    try {
      // oAuth login.
      let loginResponse: TorusKey;
      if (!idTokenLoginParams.subVerifier) {
        // single verifier login.
        loginResponse = await (this.tKey.serviceProvider as TorusServiceProvider).customAuthInstance.getTorusKey(
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
        loginResponse = await (this.tKey.serviceProvider as TorusServiceProvider).customAuthInstance.getAggregateTorusKey(verifier, verifierId, [
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

      await this.setupTkey(importTssKey);
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error((err as Error).message);
    }
  }

  private async handleRedirectResult(): Promise<void> {
    this.checkReady();

    try {
      const result = await this.torusSp.customAuthInstance.getRedirectResult();

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
    if (this.state.remoteClient) throw new Error("remoteClient is present, inputFactorKey are not allowed");
    try {
      // input tkey device share when required share > 0 ( or not reconstructed )
      // assumption tkey shares will not changed
      if (!this.tKey.privKey) {
        const factorKeyMetadata = await this.getFactorKeyMetadata(factorKey);
        await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
      }

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
    if (!this.state.factorKey && !this.state.remoteClient) throw new Error("factorKey not present");
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

  public getTssPublicKey(): TkeyPoint {
    this.checkReady();
    return this.tKey.getTSSPub();
  }

  public async enableMFA(enableMFAParams: EnableMFAParams, recoveryFactor = true): Promise<string> {
    this.checkReady();

    const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.web3AuthClientId);
    if (!(await this.checkIfFactorKeyValid(hashedFactorKey))) {
      if (this.tKey._localMetadataTransitions[0].length) throw new Error("CommitChanges are required before enabling MFA");
      throw new Error("MFA already enabled");
    }

    let browserData;

    if (this.options.uxMode === "nodejs") {
      browserData = {
        browserName: "Node Env",
        browserVersion: "",
        deviceName: "nodejs",
      };
    } else {
      const browserInfo = bowser.parse(navigator.userAgent);
      const browserName = `${browserInfo.browser.name}`;
      browserData = {
        browserName,
        browserVersion: browserInfo.browser.version,
        deviceName: browserInfo.os.name,
      };
    }

    const deviceFactorKey = new BN(await this.createFactor({ shareType: TssShareType.DEVICE, additionalMetadata: browserData }), "hex");
    storeWebBrowserFactor(deviceFactorKey, this);
    await this.inputFactorKey(new BN(deviceFactorKey, "hex"));

    const hashedFactorPub = getPubKeyPoint(hashedFactorKey);
    await this.deleteFactor(hashedFactorPub, hashedFactorKey);
    await this.deleteMetadataShareBackup(hashedFactorKey);

    // only recovery factor = true
    if (recoveryFactor) {
      const backupFactorKey = await this.createFactor({ shareType: TssShareType.RECOVERY, ...enableMFAParams });
      return backupFactorKey;
    }
    // update to undefined for next major release
    return "";
  }

  public getTssFactorPub = (): string[] => {
    this.checkReady();

    if (!this.state.factorKey && !this.state.remoteClient) throw new Error("factorKey not present");
    const factorPubsList = this.tKey.metadata.factorPubs[this.tKey.tssTag];
    return factorPubsList.map((factorPub) => Point.fromTkeyPoint(factorPub).toBufferSEC1(true).toString("hex"));
  };

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

    const factorPub = getPubKeyPoint(factorKey);

    if (this.getTssFactorPub().includes(Point.fromTkeyPoint(factorPub).toBufferSEC1(true).toString("hex"))) {
      throw new Error("Factor already exists");
    }

    try {
      await this.copyOrCreateShare(shareType, factorPub);
      await this.backupMetadataShare(factorKey);
      await this.addFactorDescription(factorKey, shareDescription, additionalMetadata);
      if (!this.tKey.manualSync) await this.tKey._syncShareMetadata();
      return scalarBNToBufferSEC1(factorKey).toString("hex");
    } catch (error) {
      log.error("error creating factor", error);
      throw error;
    }
  }

  // function for setting up provider
  public getPublic: () => Promise<Buffer> = async () => {
    let { tssPubKey } = this.state;
    if (tssPubKey.length === FIELD_ELEMENT_HEX_LEN + 1) {
      tssPubKey = tssPubKey.subarray(1);
    }
    return tssPubKey;
  };

  public sign = async (msgHash: Buffer): Promise<{ v: number; r: Buffer; s: Buffer }> => {
    if (this.state.remoteClient) {
      return this.remoteSign(msgHash);
    }
    return this.localSign(msgHash);
  };

  public localSign = async (msgHash: Buffer) => {
    // PreSetup
    let { tssShareIndex, tssPubKey } = this.state;
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

    if (tssPubKey.length === FIELD_ELEMENT_HEX_LEN + 1) {
      tssPubKey = tssPubKey.subarray(1);
    }

    const vid = `${this.verifier}${DELIMITERS.Delimiter1}${this.verifierId}`;
    const sessionId = `${vid}${DELIMITERS.Delimiter2}default${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}`;

    const parties = 4;
    const clientIndex = parties - 1;
    // 1. setup
    // generate endpoints for servers
    const { nodeIndexes } = await (this.tKey.serviceProvider as TorusServiceProvider).getTSSPubKey(
      this.tKey.tssTag,
      this.tKey.metadata.tssNonces[this.tKey.tssTag]
    );
    const {
      endpoints,
      tssWSEndpoints,
      partyIndexes,
      nodeIndexesReturned: participatingServerDKGIndexes,
    } = generateTSSEndpoints(torusNodeTSSEndpoints, parties, clientIndex, nodeIndexes);
    const randomSessionNonce = keccak256(Buffer.from(generatePrivate().toString("hex") + Date.now(), "utf8")).toString("hex");
    const tssImportUrl = `${torusNodeTSSEndpoints[0]}/v1/clientWasm`;
    // session is needed for authentication to the web3auth infrastructure holding the factor 1
    const currentSession = `${sessionId}${randomSessionNonce}`;

    let tss: typeof TssLib;
    if (this.options.uxMode === "nodejs") {
      tss = this.options.tssLib as typeof TssLib;
    } else {
      tss = await import("@toruslabs/tss-lib");
      await tss.default(tssImportUrl);
    }
    // setup mock shares, sockets and tss wasm files.
    const [sockets] = await Promise.all([setupSockets(tssWSEndpoints, randomSessionNonce)]);

    const dklsCoeff = getDKLSCoeff(true, participatingServerDKGIndexes, tssShareIndex as number);
    const denormalisedShare = dklsCoeff.mul(tssShare).umod(CURVE.curve.n);
    const share = scalarBNToBufferSEC1(denormalisedShare).toString("base64");

    if (!currentSession) {
      throw new Error(`sessionAuth does not exist ${currentSession}`);
    }

    const signatures = await this.getSigningSignatures(msgHash.toString("hex"));
    if (!signatures) {
      throw new Error(`Signature does not exist ${signatures}`);
    }

    const client = new Client(currentSession, clientIndex, partyIndexes, endpoints, sockets, share, tssPubKey.toString("base64"), true, tssImportUrl);
    const serverCoeffs: Record<number, string> = {};
    for (let i = 0; i < participatingServerDKGIndexes.length; i++) {
      const serverIndex = participatingServerDKGIndexes[i];
      serverCoeffs[serverIndex] = getDKLSCoeff(false, participatingServerDKGIndexes, tssShareIndex as number, serverIndex).toString("hex");
    }

    client.precompute(tss, { signatures, server_coeffs: serverCoeffs });

    await client.ready().catch((err) => {
      client.cleanup(tss, { signatures, server_coeffs: serverCoeffs });
      throw err;
    });

    let { r, s, recoveryParam } = await client.sign(tss, Buffer.from(msgHash).toString("base64"), true, "", "keccak256", {
      signatures,
    });

    if (recoveryParam < 27) {
      recoveryParam += 27;
    }
    // skip await cleanup
    client.cleanup(tss, { signatures, server_coeffs: serverCoeffs });
    return { v: recoveryParam, r: scalarBNToBufferSEC1(r), s: scalarBNToBufferSEC1(s) };
  };

  async deleteFactor(factorPub: TkeyPoint, factorKey?: BNString): Promise<void> {
    if (!this.state.factorKey && !this.state.remoteClient) throw new Error("Factor key not present");
    if (!this.tKey.metadata.factorPubs) throw new Error("Factor pubs not present");
    const remainingFactors = this.tKey.metadata.factorPubs[this.tKey.tssTag].length || 0;
    if (remainingFactors <= 1) throw new Error("Cannot delete last factor");
    const fpp = Point.fromTkeyPoint(factorPub);

    const signatures = await this.getSigningSignatures("delete factor");
    if (this.state.remoteClient) {
      const remoteStateFpp = this.state.remoteClient.remoteFactorPub;
      if (fpp.equals(Point.fromTkeyPoint(getPubKeyPoint(new BN(remoteStateFpp, "hex"))))) {
        throw new Error("Cannot delete current active factor");
      }
      await deleteFactorAndRefresh(
        this.tKey,
        factorPub,
        new BN(0), // not used in remoteClient
        signatures,
        this.state.remoteClient
      );
    } else {
      const stateFpp = Point.fromTkeyPoint(getPubKeyPoint(this.state.factorKey));
      if (fpp.equals(stateFpp)) {
        throw new Error("Cannot delete current active factor");
      }
      await deleteFactorAndRefresh(this.tKey, factorPub, this.state.factorKey, signatures);
    }

    const factorPubHex = fpp.toBufferSEC1(true).toString("hex");
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
      if (derivedFactorPub.equals(fpp)) {
        await this.deleteMetadataShareBackup(factorKeyBN);
      }
    }

    if (!this.tKey.manualSync) await this.tKey._syncShareMetadata();
  }

  public async logout(): Promise<void> {
    if (this.sessionManager.sessionId) {
      // throw new Error("User is not logged in.");
      await this.sessionManager.invalidateSession();
    }
    this.currentStorage.set("sessionId", "");
    this.resetState();
    await this.init({ handleRedirectResult: false });
  }

  public getUserInfo(): UserInfo {
    if (!this.state.userInfo) {
      throw new Error("user is not logged in.");
    }
    return this.state.userInfo;
  }

  public getKeyDetails(): MPCKeyDetails {
    this.checkReady();
    const tkeyDetails = this.tKey.getKeyDetails();
    const tssPubKey = this.state.tssPubKey ? this.tKey.getTSSPub() : undefined;

    const factors = this.tKey.metadata.factorPubs ? this.tKey.metadata.factorPubs[this.tKey.tssTag] : [];
    const keyDetails: MPCKeyDetails = {
      // use tkey's for now
      requiredFactors: tkeyDetails.requiredShares,
      threshold: tkeyDetails.threshold,
      totalFactors: factors.length + 1,
      shareDescriptions: this.tKey.getMetadata().getShareDescription(),
      metadataPubKey: tkeyDetails.pubKey,
      tssPubKey,
    };
    return keyDetails;
  }

  public async commitChanges(): Promise<void> {
    this.checkReady();
    if (!this.state.factorKey && !this.state.remoteClient) throw new Error("factorKey not present");

    try {
      // in case for manualsync = true, _syncShareMetadata will not call syncLocalMetadataTransitions()
      // it will not create a new LocalMetadataTransition
      // manual call syncLocalMetadataTransitions() required to sync local transitions to storage
      await this.tKey._syncShareMetadata();
      await this.tKey.syncLocalMetadataTransitions();
    } catch (error: unknown) {
      log.error("sync metadata error", error);
      throw error;
    }
  }

  public async setManualSync(manualSync: boolean): Promise<void> {
    this.checkReady();
    // sync local transistion to storage before allow changes
    await this.tKey.syncLocalMetadataTransitions();
    this.options.manualSync = manualSync;
    this.tKey.manualSync = manualSync;
  }

  public async setupRemoteClient(params: {
    remoteClientUrl: string;
    remoteFactorPub: string;
    metadataShare: string;
    remoteClientToken: string;
    tssShareIndex: string;
  }): Promise<Promise<void>> {
    const { remoteClientUrl, remoteFactorPub, metadataShare, remoteClientToken, tssShareIndex } = params;

    const remoteClient = {
      remoteClientUrl: remoteClientUrl.at(-1) === "/" ? remoteClientUrl.slice(0, -1) : remoteClientUrl,
      remoteFactorPub,
      metadataShare,
      remoteClientToken,
    };

    const sharestore = ShareStore.fromJSON(JSON.parse(metadataShare));
    this.tkey.inputShareStoreSafe(sharestore);
    await this.tKey.reconstructKey();

    // setup Tkey
    const tssPubKey = Point.fromTkeyPoint(this.tKey.getTSSPub()).toBufferSEC1(false);
    this.updateState({ tssShareIndex: parseInt(tssShareIndex), tssPubKey, remoteClient });

    // // Finalize setup.
    // setup provider
    await this.setupProvider();
    await this.createSession();
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private async importTssKey(tssKey: string, factorPub: TkeyPoint, newTSSIndex: TssShareType = TssShareType.DEVICE): Promise<void> {
    if (!this.state.signatures) throw new Error("signatures not present");

    const tssKeyBN = new BN(tssKey, "hex");
    await this.tKey.importTssKey({ tag: this.tKey.tssTag, importKey: tssKeyBN, factorPub, newTSSIndex }, { authSignatures: this.state.signatures });
  }

  public async _UNSAFE_exportTssKey(): Promise<string> {
    if (this.state.remoteClient) throw new Error("export tss key not supported for remote client");
    if (!this.state.factorKey) throw new Error("factorKey not present");
    if (!this.state.signatures) throw new Error("signatures not present");

    const exportTssKey = await this.tKey._UNSAFE_exportTssKey({
      factorKey: this.state.factorKey,
      authSignatures: this.state.signatures,
      selectedServers: [],
    });

    return exportTssKey.toString("hex", FIELD_ELEMENT_HEX_LEN);
  }

  private getTssNonce(): number {
    if (!this.tKey.metadata.tssNonces) throw new Error("tssNonce not present");
    const tssNonce = this.tKey.metadata.tssNonces[this.tKey.tssTag];
    return tssNonce;
  }

  private async setupTkey(importTssKey?: string): Promise<void> {
    if (this.state.remoteClient) {
      log.warn("remote client is present, setupTkey are skipped");
      return;
    }
    if (!this.state.oAuthKey) {
      throw new Error("user not logged in");
    }
    const existingUser = await this.isMetadataPresent(this.state.oAuthKey);
    if (!existingUser) {
      // Generate or use hash factor and initialize tkey with it.
      let factorKey: BN;
      if (this.options.disableHashedFactorKey) {
        factorKey = generateFactorKey().private;
        // delete previous hashed factorKey if present
        const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.web3AuthClientId);
        await this.deleteMetadataShareBackup(hashedFactorKey);
      } else {
        factorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.web3AuthClientId);
      }
      const deviceTSSIndex = TssShareType.DEVICE;
      const factorPub = getPubKeyPoint(factorKey);
      if (!importTssKey) {
        const deviceTSSShare = new BN(generatePrivate());
        await this.tKey.initialize({ useTSS: true, factorPub, deviceTSSShare, deviceTSSIndex });
      } else {
        await this.tKey.initialize();
        await this.importTssKey(importTssKey, factorPub, deviceTSSIndex);
      }

      // Finalize initialization.
      await this.tKey.reconstructKey();
      await this.finalizeTkey(factorKey);

      // Store factor description.
      await this.backupMetadataShare(factorKey);
      if (this.options.disableHashedFactorKey) {
        await this.addFactorDescription(factorKey, FactorKeyTypeShareDescription.Other);
      } else {
        await this.addFactorDescription(factorKey, FactorKeyTypeShareDescription.HashedShare);
      }
    } else {
      if (importTssKey) throw new Error("Cannot import tss key for existing user");
      await this.tKey.initialize({ neverInitializeNewKey: true });
      const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.web3AuthClientId);
      if ((await this.checkIfFactorKeyValid(hashedFactorKey)) && !this.options.disableHashedFactorKey) {
        // Initialize tkey with existing hashed share if available.
        const factorKeyMetadata: ShareStore = await this.getFactorKeyMetadata(hashedFactorKey);
        await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
        await this.tKey.reconstructKey();
        await this.finalizeTkey(hashedFactorKey);
      }
    }
  }

  private async finalizeTkey(factorKey: BN) {
    // Read tss meta data.
    const { tssIndex: tssShareIndex } = await this.tKey.getTSSShare(factorKey);
    const tssPubKey = Point.fromTkeyPoint(this.tKey.getTSSPub()).toBufferSEC1(false);

    this.updateState({ tssShareIndex, tssPubKey, factorKey });

    // Finalize setup.
    if (!this.tKey.manualSync) await this.tKey.syncLocalMetadataTransitions();
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
      if (!result.factorKey && !result.remoteClient) throw new Error("factorKey not present");
      let metadataShare;

      if (result.factorKey) {
        const factorKey = new BN(result.factorKey, "hex");
        if (!factorKey) {
          throw new Error("Invalid factor key");
        }
        metadataShare = await this.getFactorKeyMetadata(factorKey);
      } else {
        metadataShare = ShareStore.fromJSON(JSON.parse(result.remoteClient.metadataShare));
      }
      this.torusSp.postboxKey = new BN(result.oAuthKey, "hex");
      this.torusSp.verifierName = result.userInfo.aggregateVerifier || result.userInfo.verifier;
      this.torusSp.verifierId = result.userInfo.verifierId;
      this.torusSp.verifierType = result.userInfo.aggregateVerifier ? "aggregate" : "normal";
      await this.tKey.initialize({ neverInitializeNewKey: true });
      await this.tKey.inputShareStoreSafe(metadataShare, true);
      await this.tKey.reconstructKey();

      this.updateState({
        factorKey: new BN(result.factorKey, "hex"),
        oAuthKey: result.oAuthKey,
        tssShareIndex: result.tssShareIndex,
        tssPubKey: Buffer.from(result.tssPubKey.padStart(FIELD_ELEMENT_HEX_LEN, "0"), "hex"),
        signatures: result.signatures,
        userInfo: result.userInfo,
        remoteClient: result.remoteClient,
      });
    } catch (err) {
      log.error("error trying to authorize session", err);
    }
  }

  private async createSession() {
    if (this.options.sessionTime === 0) {
      log.info("sessionTime is 0, not creating session");
      return;
    }

    try {
      const sessionId = OpenloginSessionManager.generateRandomSessionKey();
      this.sessionManager.sessionId = sessionId;
      const { oAuthKey, factorKey, userInfo, tssShareIndex, tssPubKey, remoteClient } = this.state;
      if (!this.state.factorKey && !this.state.remoteClient) throw new Error("factorKey not present");

      if (!this.state.remoteClient) {
        const { tssShare } = await this.tKey.getTSSShare(this.state.factorKey);
        if (!oAuthKey || !factorKey || !tssShare || !tssPubKey || !userInfo) {
          throw new Error("User not logged in");
        }
      }
      const payload: SessionData = {
        oAuthKey,
        factorKey: factorKey?.toString("hex"),
        tssShareIndex: tssShareIndex as number,
        tssPubKey: Buffer.from(tssPubKey).toString("hex"),
        signatures: this.signatures,
        userInfo,
        remoteClient,
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

  private async checkIfFactorKeyValid(factorKey: BN): Promise<boolean> {
    this.checkReady();
    const factorKeyMetadata = await this.tKey?.storageLayer.getMetadata<StringifiedType>({ privKey: factorKey });
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND" || factorKeyMetadata.message === "SHARE_DELETED") {
      return false;
    }
    log.info("factorKeyMetadata", factorKeyMetadata);
    return true;
  }

  private async getFactorKeyMetadata(factorKey: BN): Promise<ShareStore> {
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
    if (!this.state.factorKey && !this.state.remoteClient) {
      throw new Error("factorKey not present");
    }
    if (VALID_SHARE_INDICES.indexOf(newFactorTSSIndex) === -1) {
      throw new Error(`invalid new share index: must be one of ${VALID_SHARE_INDICES}`);
    }

    if (this.tKey.metadata.factorPubs[this.tKey.tssTag].length >= MAX_FACTORS) {
      throw new Error("Maximum number of factors reached");
    }
    const signatures = await this.getSigningSignatures("create factor");
    if (this.state.tssShareIndex !== newFactorTSSIndex) {
      // Generate new share.
      if (!this.state.remoteClient) {
        await addFactorAndRefresh(this.tKey, newFactorPub, newFactorTSSIndex, this.state.factorKey, signatures);
      } else {
        await addFactorAndRefresh(this.tKey, newFactorPub, newFactorTSSIndex, this.state.factorKey, signatures, this.state.remoteClient);
      }
      return;
    }
    // TODO : fix this
    let userEnc: EncryptedMessage;
    if (this.state.remoteClient) {
      const remoteFactorPub = TkeyPoint.fromCompressedPub(this.state.remoteClient.remoteFactorPub);
      const factorEnc = this.tkey.getFactorEncs(remoteFactorPub);
      const tssCommits = this.tkey.getTSSCommits();
      const dataRequired = {
        factorEnc,
        tssCommits,
        factorPub: newFactorPub,
      };

      userEnc = (
        await post<{ data?: EncryptedMessage }>(
          `${this.state.remoteClient.remoteClientUrl}/api/mpc/copy_tss_share`,
          { dataRequired },
          {
            headers: {
              Authorization: `Bearer ${this.state.remoteClient.remoteClientToken}`,
            },
          }
        )
      ).data;
    } else {
      const { tssShare } = await this.tKey.getTSSShare(this.state.factorKey);
      userEnc = await encrypt(Point.fromTkeyPoint(newFactorPub).toBufferSEC1(false), scalarBNToBufferSEC1(tssShare));
    }

    const updatedFactorPubs = this.tKey.metadata.factorPubs[this.tKey.tssTag].concat([newFactorPub]);
    const factorEncs = JSON.parse(JSON.stringify(this.tKey.metadata.factorEncs[this.tKey.tssTag]));
    const factorPubID = newFactorPub.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    factorEncs[factorPubID] = {
      tssIndex: this.state.tssShareIndex,
      type: "direct",
      userEnc,
      serverEncs: [],
    };
    this.tKey.metadata.addTSSData({
      tssTag: this.tKey.tssTag,
      factorPubs: updatedFactorPubs,
      factorEncs,
    });

    // if (!this.tKey.manualSync) await this.tKey._syncShareMetadata();
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

  private async deleteMetadataShareBackup(factorKey: BN): Promise<void> {
    await this.tKey.addLocalMetadataTransitions({ input: [{ message: SHARE_DELETED, dateAdded: Date.now() }], privKey: [factorKey] });
    if (!this.tkey?.manualSync) await this.tkey?.syncLocalMetadataTransitions();
  }

  private async backupMetadataShare(factorKey: BN) {
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
    additionalMetadata: Record<string, string> = {},
    updateMetadata = true
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
    await this.tKey?.addShareDescription(factorPub, JSON.stringify(params), updateMetadata);
  }

  private async setupProvider(): Promise<void> {
    const signingProvider = new EthereumSigningProvider({ config: { chainConfig: this.options.chainConfig } });
    await signingProvider.setupProvider({ sign: this.sign, getPublic: this.getPublic });
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

  private async getSigningSignatures(data: string): Promise<string[]> {
    if (!this.signatures) throw new Error("signatures not present");
    if (this.options.authorizationUrl.length === 0) {
      if (this.state.remoteClient && !this.options.allowNoAuthorizationForRemoteClient) {
        throw new Error("remote client is present, authorizationUrl is required");
      }
      return this.signatures;
    }
    const sigPromise = this.options.authorizationUrl.map(async (url) => {
      const { sig } = await post<{ sig?: string }>(url, {
        signatures: this.signatures,
        verifier: this.verifier,
        verifierID: this.verifierId,
        clientID: this.options.web3AuthClientId,
        data,
      });

      return sig;
    });
    return Promise.all(sigPromise);
  }

  public async remoteSign(msgHash: Buffer): Promise<{ v: number; r: Buffer; s: Buffer }> {
    if (!this.state.remoteClient.remoteClientUrl) throw new Error("remoteClientUrl not present");

    // PreSetup
    const { torusNodeTSSEndpoints } = await this.nodeDetailManager.getNodeDetails({
      verifier: "test-verifier",
      verifierId: "test@example.com",
    });

    const tssCommits = this.tKey.getTSSCommits();

    const tssNonce = this.getTssNonce() || 0;

    const vid = `${this.verifier}${DELIMITERS.Delimiter1}${this.verifierId}`;
    const sessionId = `${vid}${DELIMITERS.Delimiter2}default${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}`;

    const parties = 4;
    const clientIndex = parties - 1;

    const { nodeIndexes } = await (this.tKey.serviceProvider as TorusServiceProvider).getTSSPubKey(
      this.tKey.tssTag,
      this.tKey.metadata.tssNonces[this.tKey.tssTag]
    );

    if (parties - 1 > nodeIndexes.length) {
      throw new Error(`Not enough nodes to perform TSS - parties :${parties}, nodeIndexes:${nodeIndexes.length}`);
    }
    const { endpoints, tssWSEndpoints, partyIndexes, nodeIndexesReturned } = generateTSSEndpoints(
      torusNodeTSSEndpoints,
      parties,
      clientIndex,
      nodeIndexes
    );

    const factor = TkeyPoint.fromCompressedPub(this.state.remoteClient.remoteFactorPub);
    const factorEnc = this.tKey.getFactorEncs(factor);

    const data = {
      dataRequired: {
        factorEnc,
        sessionId,
        tssNonce,
        nodeIndexes: nodeIndexesReturned,
        tssCommits: tssCommits.map((commit) => commit.toJSON()),
        signatures: await this.getSigningSignatures(msgHash.toString("hex")),
        serverEndpoints: { endpoints, tssWSEndpoints, partyIndexes },
      },
      msgHash: msgHash.toString("hex"),
    };

    const result = await post<{ data?: Record<string, string> }>(`${this.state.remoteClient.remoteClientUrl}/api/mpc/sign`, data, {
      headers: {
        Authorization: `Bearer ${this.state.remoteClient.remoteClientToken}`,
      },
    });
    const { r, s, v } = result.data as { v: string; r: string; s: string };
    return { v: parseInt(v), r: Buffer.from(r, "hex"), s: Buffer.from(s, "hex") };
  }
}
