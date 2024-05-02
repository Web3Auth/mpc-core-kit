/* eslint-disable @typescript-eslint/member-ordering */
import { createSwappableProxy, SwappableProxy } from "@metamask/swappable-obj-proxy";
import { BNString, encrypt, getPubKeyPoint, Point as TkeyPoint, SHARE_DELETED, ShareStore, StringifiedType } from "@tkey-mpc/common-types";
import ThresholdKey, { CoreError, lagrangeInterpolation } from "@tkey-mpc/core";
import { TorusServiceProvider } from "@tkey-mpc/service-provider-torus";
import { ShareSerializationModule } from "@tkey-mpc/share-serialization";
import { TorusStorageLayer } from "@tkey-mpc/storage-layer-torus";
import { SIGNER_MAP } from "@toruslabs/constants";
import { AGGREGATE_VERIFIER, TORUS_METHOD, TorusAggregateLoginResponse, TorusLoginResponse, UX_MODE } from "@toruslabs/customauth";
import type { UX_MODE_TYPE } from "@toruslabs/customauth/dist/types/utils/enums";
import { generatePrivate } from "@toruslabs/eccrypto";
import { NodeDetailManager } from "@toruslabs/fetch-node-details";
import { keccak256 } from "@toruslabs/metadata-helpers";
import { OpenloginSessionManager } from "@toruslabs/openlogin-session-manager";
import TorusUtils, { TorusKey } from "@toruslabs/torus.js";
import { Client, getDKLSCoeff, setupSockets } from "@toruslabs/tss-client";
import type * as TssLib from "@toruslabs/tss-lib";
import { CHAIN_NAMESPACES, CustomChainConfig, log, SafeEventEmitterProvider } from "@web3auth/base";
import { EthereumSigningProvider } from "@web3auth-mpc/ethereum-provider";
import BN from "bn.js";
import bowser from "bowser";

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
import CoreKitError from "./errors";
import { AsyncStorage, asyncStoreFactor, BrowserStorage, storeWebBrowserFactor } from "./helper/browserStorage";
import {
  AggregateVerifierLoginParams,
  COREKIT_STATUS,
  CoreKitMode,
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
  public state: Web3AuthState = { accountIndex: 0 };

  private options: Web3AuthOptionsWithDefaults;

  private providerProxy: SwappableProxy<SafeEventEmitterProvider> | null = null;

  private torusSp: TorusServiceProvider | null = null;

  private storageLayer: TorusStorageLayer | null = null;

  private tkey: ThresholdKey | null = null;

  private sessionManager!: OpenloginSessionManager<SessionData>;

  private currentStorage!: BrowserStorage | AsyncStorage;

  private nodeDetailManager!: NodeDetailManager;

  private _storageBaseKey = "corekit_store";

  private enableLogging = false;

  private ready = false;

  constructor(options: Web3AuthOptions) {
    if (!options.chainConfig) options.chainConfig = DEFAULT_CHAIN_CONFIG;
    if (options.chainConfig.chainNamespace !== CHAIN_NAMESPACES.EIP155) {
      throw CoreKitError.chainConfigInvalid();
    }
    if (!options.web3AuthClientId) {
      throw CoreKitError.clientIdInvalid();
    }

    const isNodejsOrRN = this.isNodejsOrRN(options.uxMode);

    if (!options.storageKey) options.storageKey = "local";
    if (isNodejsOrRN && ["local", "session"].includes(options.storageKey.toString()) && !options.asyncStorageKey) {
      throw CoreKitError.storageTypeUnsupported(`Unsupported storage type ${options.storageKey} for ${options.uxMode} mode.`);
    }

    if (isNodejsOrRN && !options.tssLib) {
      throw CoreKitError.tssLibRequired(`'tssLib' is required when running in ${options.uxMode} mode.`);
    }

    if (options.enableLogging) {
      log.enableAll();
      this.enableLogging = true;
    } else log.setLevel("error");
    if (typeof options.manualSync !== "boolean") options.manualSync = false;
    if (!options.web3AuthNetwork) options.web3AuthNetwork = WEB3AUTH_NETWORK.MAINNET;
    if (!options.sessionTime) options.sessionTime = 86400;
    if (!options.uxMode) options.uxMode = UX_MODE.REDIRECT;
    if (!options.redirectPathName) options.redirectPathName = "redirect";
    if (!options.baseUrl) options.baseUrl = isNodejsOrRN ? "https://localhost" : `${window?.location.origin}/serviceworker`;
    if (!options.disableHashedFactorKey) options.disableHashedFactorKey = false;
    if (!options.hashedFactorNonce) options.hashedFactorNonce = options.web3AuthClientId;
    if (options.setupProviderOnInit === undefined) options.setupProviderOnInit = true;

    this.options = options as Web3AuthOptionsWithDefaults;

    if (this.options.asyncStorageKey) {
      this.currentStorage = AsyncStorage.getInstance(this._storageBaseKey, options.asyncStorageKey);
    } else {
      this.currentStorage = BrowserStorage.getInstance(this._storageBaseKey, this.options.storageKey);
    }

    this.nodeDetailManager = new NodeDetailManager({
      network: this.options.web3AuthNetwork,
      enableLogging: options.enableLogging,
    });

    const asyncConstructor = async () => {
      const sessionId = await this.currentStorage.get<string>("sessionId");
      this.sessionManager = new OpenloginSessionManager({
        sessionTime: this.options.sessionTime,
        sessionId,
      });
    };
    asyncConstructor();
  }

  get tKey(): ThresholdKey {
    if (this.tkey === null) {
      throw CoreKitError.tkeyInstanceUninitialized();
    }
    return this.tkey;
  }

  get provider(): SafeEventEmitterProvider | null {
    return this.providerProxy ? this.providerProxy : null;
  }

  set provider(_: SafeEventEmitterProvider | null) {
    throw CoreKitError.default("Set provider has not been implemented.");
  }

  get signatures(): string[] {
    return this.state?.signatures ? this.state.signatures : [];
  }

  set signatures(_: string[] | null) {
    throw CoreKitError.default("Set signatures has not been implemented.");
  }

  // this return oauthkey which is used by demo to reset account.
  // this is not the same metadataKey from tkey.
  // will be fixed in next major release
  get metadataKey(): string | null {
    return this.state?.oAuthKey ? this.state.oAuthKey : null;
  }

  set metadataKey(_: string | null) {
    throw CoreKitError.default("Set metadataKey has not been implemented.");
  }

  get status(): COREKIT_STATUS {
    try {
      // metadata will be present if tkey is initialized (1 share)
      // if 2 shares are present, then privKey will be present after metadatakey(tkey) reconstruction
      const { tkey } = this;
      if (!tkey) return COREKIT_STATUS.NOT_INITIALIZED;
      if (!tkey.metadata) return COREKIT_STATUS.INITIALIZED;
      if (!tkey.privKey || !this.state.factorKey) return COREKIT_STATUS.REQUIRED_SHARE;
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

  // RecoverTssKey only valid for user that enable MFA where user has 2 type shares :
  // TssShareType.DEVICE and TssShareType.RECOVERY
  // if the factors key provided is the same type recovery will not works
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
        // reset instance before throw error
        await this.init();
        throw CoreKitError.duplicateTssIndex();
      }
      tssIndexes.push(tssIndex);
      tssIndexesBN.push(new BN(tssIndex));
      tssShares.push(tssShare);
    }

    const finalKey = lagrangeInterpolation(tssShares, tssIndexesBN);
    // reset instance after recovery completed
    await this.init();
    return finalKey.toString("hex", 64);
  }

  public async init(params: InitParams = { handleRedirectResult: true }): Promise<void> {
    this.resetState();
    if (params.rehydrate === undefined) params.rehydrate = true;

    const nodeDetails = await this.nodeDetailManager.getNodeDetails({ verifier: "test-verifier", verifierId: "test@example.com" });

    if (!nodeDetails) {
      throw CoreKitError.nodeDetailsRetrievalFailed();
    }

    this.torusSp = new TorusServiceProvider({
      useTSS: true,
      customAuthArgs: {
        web3AuthClientId: this.options.web3AuthClientId,
        baseUrl: this.options.baseUrl,
        uxMode: this.isNodejsOrRN(this.options.uxMode) ? UX_MODE.REDIRECT : (this.options.uxMode as UX_MODE_TYPE),
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
      // on failed redirect, instance is reseted.
      await this.handleRedirectResult();

      // if not redirect flow try to rehydrate session if available
    } else if (params.rehydrate && this.sessionManager.sessionId) {
      // swallowed, should not throw on rehydrate timed out session
      const sessionResult = await this.sessionManager.authorizeSession().catch(async (err) => {
        log.info("rehydrate session error", err);
      });

      // try rehydrate session
      if (sessionResult) {
        await this.rehydrateSession(sessionResult);
      } else {
        // feature gating on no session rehydration
        await this.featureRequest();
      }
    } else {
      // feature gating if not redirect flow or session rehydration
      await this.featureRequest();
    }

    // if not redirect flow or session rehydration, ask for factor key to login
  }

  public async loginWithOauth(params: OauthLoginParams): Promise<void> {
    this.checkReady();
    if (this.isNodejsOrRN(this.options.uxMode)) {
      throw CoreKitError.oauthLoginUnsupported(`Oauth login is NOT supported in ${this.options.uxMode} mode.`);
    }
    const { importTssKey } = params;
    const tkeyServiceProvider = this.tKey.serviceProvider as TorusServiceProvider;

    // workaround for atomic sync
    this.tkey.manualSync = true;

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

      // workaround for atomic sync, commit changes if not manualSync
      if (!this.options.manualSync) await this.commitChanges();
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) {
          throw CoreKitError.default(ERRORS.TKEY_SHARES_REQUIRED);
        }
      }
      throw CoreKitError.default((err as Error).message);
    } finally {
      // workaround for atomic sync, restore manual sync
      this.tkey.manualSync = this.options.manualSync;
    }
  }

  /**
   * login with JWT.
   * @param idTokenLoginParams - login parameter required by web3auth for login with JWT.
   * @param opt - prefetchTssPublicKeys - option prefetch server tssPubs for new user registration.
   *              For best performance, set it to the number of factor you want to create for new user. Set it 0 for existing user.
   *              default is 1, max value is 3
   */
  public async loginWithJWT(
    idTokenLoginParams: IdTokenLoginParams,
    opt: { prefetchTssPublicKeys: number } = { prefetchTssPublicKeys: 1 }
  ): Promise<void> {
    this.checkReady();
    if (opt.prefetchTssPublicKeys > 3) {
      throw CoreKitError.prefetchValueExceeded(`The prefetch value '${opt.prefetchTssPublicKeys}' exceeds the maximum allowed limit of 3.`);
    }

    const { importTssKey } = idTokenLoginParams;
    const { verifier, verifierId, idToken } = idTokenLoginParams;

    (this.tKey.serviceProvider as TorusServiceProvider).verifierName = verifier;
    (this.tKey.serviceProvider as TorusServiceProvider).verifierId = verifierId;

    // workaround for atomic sync
    this.tkey.manualSync = true;
    try {
      // prefetch tss pub key
      const prefetchTssPubs = [];
      for (let i = 0; i < opt.prefetchTssPublicKeys; i++) {
        prefetchTssPubs.push(this.tkey.serviceProvider.getTSSPubKey("default", i));
      }
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

      this.updateState({
        oAuthKey: oAuthShare,
        userInfo: { ...parseToken(idToken), verifier, verifierId },
        signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
      });

      // wait for prefetch completed before setup tkey
      await Promise.all(prefetchTssPubs);

      await this.setupTkey(importTssKey);

      // workaround for atomic sync, commit changes if not manualSync
      if (!this.options.manualSync) await this.commitChanges();
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) {
          throw CoreKitError.default(ERRORS.TKEY_SHARES_REQUIRED);
        }
      }
      throw CoreKitError.default((err as Error).message);
    } finally {
      // workaround for atomic syn, restore manual sync
      this.tkey.manualSync = this.options.manualSync;
    }
  }

  public async handleRedirectResult(): Promise<void> {
    this.checkReady();

    try {
      const result = await this.torusSp.customAuthInstance.getRedirectResult();

      if (result.method === TORUS_METHOD.TRIGGER_LOGIN) {
        const data = result.result as TorusLoginResponse;
        if (!data) {
          throw CoreKitError.invalidTorusLoginResponse();
        }
        this.torusSp.verifierType = "normal";
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.verifier;
      } else if (result.method === TORUS_METHOD.TRIGGER_AGGREGATE_LOGIN) {
        const data = result.result as TorusAggregateLoginResponse;
        if (!data) {
          throw CoreKitError.invalidTorusAggregateLoginResponse();
        }
        this.updateState({
          oAuthKey: this._getOAuthKey(data),
          userInfo: data.userInfo[0],
          signatures: this._getSignatures(data.sessionData.sessionTokenData),
        });
        this.torusSp.verifierType = "aggregate";
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.aggregateVerifier;
      } else {
        throw CoreKitError.unsupportedRedirectMethod();
      }

      const userInfo = this.getUserInfo();
      if (!this.state.oAuthKey) {
        throw CoreKitError.oauthKeyMissing("oAuthKey not present in state after processing redirect result.");
      }
      this.torusSp.postboxKey = new BN(this.state.oAuthKey, "hex");
      this.torusSp.verifierId = userInfo.verifierId;
      await this.setupTkey();
    } catch (error: unknown) {
      this.resetState();
      log.error("error while handling redirect result", error);
      throw CoreKitError.default((error as Error).message);
    }
  }

  public async inputFactorKey(factorKey: BN): Promise<void> {
    this.checkReady();
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
        if (err.code === 1302) {
          throw CoreKitError.default(ERRORS.TKEY_SHARES_REQUIRED);
        }
      }
      throw CoreKitError.default((err as Error).message);
    }
  }

  public setTssWalletIndex(accountIndex: number) {
    this.updateState({ tssPubKey: Point.fromTkeyPoint(this.tKey.getTSSPub(accountIndex)).toBufferSEC1(false), accountIndex });
  }

  public getCurrentFactorKey(): IFactorKey {
    this.checkReady();
    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when getting current factor key.");
    }
    if (!this.state.tssShareIndex) {
      throw CoreKitError.tssShareTypeIndexMissing("TSS Share Type (Index) not present in state when getting current factor key.");
    }
    try {
      return {
        factorKey: this.state.factorKey,
        shareType: this.state.tssShareIndex,
      };
    } catch (err: unknown) {
      log.error("state error", err);
      throw CoreKitError.default((err as Error).message);
    }
  }

  // Deprecated soon
  // use getPublicSync instead
  public getTssPublicKey(): TkeyPoint {
    this.checkReady();
    // pass this optional account index;
    return this.tKey.getTSSPub(this.state.accountIndex);
  }

  public async enableMFA(enableMFAParams: EnableMFAParams, recoveryFactor = true): Promise<string> {
    this.checkReady();

    const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.hashedFactorNonce);
    if (!(await this.checkIfFactorKeyValid(hashedFactorKey))) {
      if (this.tKey._localMetadataTransitions[0].length) {
        throw CoreKitError.commitChangesBeforeMFA();
      }
      throw CoreKitError.mfaAlreadyEnabled();
    }

    try {
      let browserData;

      if (this.isNodejsOrRN(this.options.uxMode)) {
        browserData = {
          browserName: "Node Env",
          browserVersion: "",
          deviceName: "nodejs",
        };
      } else {
        // try {
        const browserInfo = bowser.parse(navigator.userAgent);
        const browserName = `${browserInfo.browser.name}`;
        browserData = {
          browserName,
          browserVersion: browserInfo.browser.version,
          deviceName: browserInfo.os.name,
        };
      }
      const deviceFactorKey = new BN(await this.createFactor({ shareType: TssShareType.DEVICE, additionalMetadata: browserData }), "hex");
      if (this.currentStorage instanceof AsyncStorage) {
        asyncStoreFactor(deviceFactorKey, this, this.options.asyncStorageKey);
      } else {
        storeWebBrowserFactor(deviceFactorKey, this, this.options.storageKey);
      }
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
    } catch (err: unknown) {
      log.error("error enabling MFA", err);
      throw CoreKitError.default((err as Error).message);
    }
  }

  public getTssFactorPub = (): string[] => {
    this.checkReady();
    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when getting tss factor public key.");
    }
    const factorPubsList = this.tKey.metadata.factorPubs[this.tKey.tssTag];
    return factorPubsList.map((factorPub) => Point.fromTkeyPoint(factorPub).toBufferSEC1(true).toString("hex"));
  };

  public async createFactor(createFactorParams: CreateFactorParams): Promise<string> {
    this.checkReady();

    let { shareType, factorKey, shareDescription, additionalMetadata } = createFactorParams;

    if (!VALID_SHARE_INDICES.includes(shareType)) {
      throw CoreKitError.newShareIndexInvalid(`Invalid share type provided (${shareType}). Valid share types are ${VALID_SHARE_INDICES}.`);
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
      throw CoreKitError.factorKeyAlreadyExists();
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
    return this.getPublicSync();
  };

  public getPublicSync: () => Buffer = () => {
    let { tssPubKey } = this.state;
    if (tssPubKey.length === FIELD_ELEMENT_HEX_LEN + 1) {
      tssPubKey = tssPubKey.subarray(1);
    }
    return Buffer.from(tssPubKey);
  };

  public sign = async (msgHash: Buffer): Promise<{ v: number; r: Buffer; s: Buffer }> => {
    // if (this.state.remoteClient) {
    //   return this.remoteSign(msgHash);
    // }
    return this.localSign(msgHash);
  };

  public localSign = async (msgHash: Buffer) => {
    // PreSetup
    const { tssShareIndex } = this.state;
    let tssPubKey = await this.getPublic();

    const { torusNodeTSSEndpoints } = await this.nodeDetailManager.getNodeDetails({
      verifier: "test-verifier",
      verifierId: "test@example.com",
    });

    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when signing.");
    }
    const { tssShare } = await this.tKey.getTSSShare(this.state.factorKey, {
      accountIndex: 0,
    });
    const tssNonce = this.getTssNonce();

    if (!tssPubKey || !torusNodeTSSEndpoints) {
      throw CoreKitError.tssPublicKeyOrEndpointsMissing();
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
    if (this.isNodejsOrRN(this.options.uxMode)) {
      tss = this.options.tssLib as typeof TssLib;
    } else {
      tss = await import("@toruslabs/tss-lib");
      await tss.default(tssImportUrl);
    }
    // setup mock shares, sockets and tss wasm files.
    const [sockets] = await Promise.all([setupSockets(tssWSEndpoints, randomSessionNonce)]);

    const dklsCoeff = getDKLSCoeff(true, participatingServerDKGIndexes, tssShareIndex as number);
    const denormalisedShare = dklsCoeff.mul(tssShare).umod(CURVE.curve.n);
    const accountNonce = this.tkey.computeAccountNonce(this.state.accountIndex);
    const derivedShare = denormalisedShare.add(accountNonce).umod(CURVE.curve.n);
    const share = scalarBNToBufferSEC1(derivedShare).toString("base64");

    if (!currentSession) {
      throw CoreKitError.activeSessionNotFound();
    }

    const signatures = await this.getSigningSignatures(msgHash.toString("hex"));
    if (!signatures) {
      throw CoreKitError.signaturesNotPresent();
    }

    const client = new Client(currentSession, clientIndex, partyIndexes, endpoints, sockets, share, tssPubKey.toString("base64"), true, tssImportUrl);
    const serverCoeffs: Record<number, string> = {};
    for (let i = 0; i < participatingServerDKGIndexes.length; i++) {
      const serverIndex = participatingServerDKGIndexes[i];
      serverCoeffs[serverIndex] = getDKLSCoeff(false, participatingServerDKGIndexes, tssShareIndex as number, serverIndex).toString("hex");
    }
    client.precompute(tss, { signatures, server_coeffs: serverCoeffs, nonce: scalarBNToBufferSEC1(this.getNonce()).toString("base64") });
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
    if (!this.state.factorKey) throw new Error("No 'factorKey' found in the current state when deleting a factor.");
    if (!this.tKey.metadata.factorPubs) throw new Error("Factor pubs not present");
    const remainingFactors = this.tKey.metadata.factorPubs[this.tKey.tssTag].length || 0;
    if (remainingFactors <= 1) throw new Error("Cannot delete the last remaining factor as at least one factor is required.");
    const fpp = Point.fromTkeyPoint(factorPub);
    const stateFpp = Point.fromTkeyPoint(getPubKeyPoint(this.state.factorKey));
    if (fpp.equals(stateFpp)) {
      throw CoreKitError.factorInUseCannotBeDeleted();
    }

    await deleteFactorAndRefresh(this.tKey, factorPub, this.state.factorKey, this.signatures);
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
      await this.sessionManager.invalidateSession();
    }
    // to accommodate async storage
    await this.currentStorage.set("sessionId", "");

    this.resetState();
    await this.init({ handleRedirectResult: false });
  }

  public getUserInfo(): UserInfo {
    if (!this.state.userInfo) {
      throw CoreKitError.userNotLoggedIn();
    }
    return this.state.userInfo;
  }

  public getKeyDetails(): MPCKeyDetails {
    this.checkReady();
    const tkeyDetails = this.tKey.getKeyDetails();
    const tssPubKey = this.state.tssPubKey ? Point.fromBufferSEC1(this.state.tssPubKey).toTkeyPoint() : undefined;

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
    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when committing changes.");
    }

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

  public async switchChain(chainConfig: CustomChainConfig): Promise<void> {
    try {
      await this.setupProvider({ chainConfig });
    } catch (error: unknown) {
      log.error("change chain config error", error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private async importTssKey(tssKey: string, factorPub: TkeyPoint, newTSSIndex: TssShareType = TssShareType.DEVICE): Promise<void> {
    if (!this.state.signatures) {
      throw CoreKitError.signaturesNotPresent("Signatures not present in state when importing tss key.");
    }

    const tssKeyBN = new BN(tssKey, "hex");
    await this.tKey.importTssKey({ tag: this.tKey.tssTag, importKey: tssKeyBN, factorPub, newTSSIndex }, { authSignatures: this.state.signatures });
  }

  public async _UNSAFE_exportTssKey(): Promise<string> {
    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when exporting tss key.");
    }
    if (!this.state.signatures) {
      throw CoreKitError.signaturesNotPresent("Signatures not present in state when exporting tss key.");
    }

    const exportTssKey = await this.tKey._UNSAFE_exportTssKey({
      factorKey: this.state.factorKey,
      authSignatures: this.state.signatures,
      selectedServers: [],
    });

    return exportTssKey.toString("hex", FIELD_ELEMENT_HEX_LEN);
  }

  private getTssNonce(): number {
    if (!this.tKey.metadata.tssNonces) {
      throw CoreKitError.tssNoncesMissing("tssNonces not present in metadata when getting tss nonce.");
    }
    const tssNonce = this.tKey.metadata.tssNonces[this.tKey.tssTag];
    return tssNonce;
  }

  private async setupTkey(importTssKey?: string): Promise<void> {
    if (!this.state.oAuthKey) {
      throw CoreKitError.userNotLoggedIn();
    }
    const existingUser = await this.isMetadataPresent(this.state.oAuthKey);

    if (!existingUser) {
      // Generate or use hash factor and initialize tkey with it.
      let factorKey: BN;
      if (this.options.disableHashedFactorKey) {
        factorKey = generateFactorKey().private;
        // delete previous hashed factorKey if present
        const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.hashedFactorNonce);
        await this.deleteMetadataShareBackup(hashedFactorKey);
      } else {
        factorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.hashedFactorNonce);
      }
      const deviceTSSIndex = TssShareType.DEVICE;
      const factorPub = getPubKeyPoint(factorKey);
      if (!importTssKey) {
        const deviceTSSShare = new BN(generatePrivate());
        await this.tKey.initialize({ useTSS: true, factorPub, deviceTSSShare, deviceTSSIndex });
      } else {
        await this.tKey.initialize();
        await this.tKey.reconstructKey();
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
      if (importTssKey) {
        throw CoreKitError.tssKeyImportNotAllowed();
      }
      await this.tKey.initialize({ neverInitializeNewKey: true });
      const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.hashedFactorNonce);
      if ((await this.checkIfFactorKeyValid(hashedFactorKey)) && !this.options.disableHashedFactorKey) {
        // Initialize tkey with existing hashed share if available.
        const factorKeyMetadata: ShareStore = await this.getFactorKeyMetadata(hashedFactorKey);
        try {
          await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
          await this.tKey.reconstructKey();
          await this.finalizeTkey(hashedFactorKey);
        } catch (err) {
          log.error("error initializing tkey with hashed share", err);
        }
      }
    }
  }

  private async finalizeTkey(factorKey: BN) {
    if (this.state.accountIndex !== 0) {
      log.warn("AccountIndex should be 0");
      this.state.accountIndex = 0;
    }
    // Read tss meta data.
    const { tssIndex: tssShareIndex } = await this.tKey.getTSSShare(factorKey);
    const tssPubKey = Point.fromTkeyPoint(this.tKey.getTSSPub()).toBufferSEC1(false);

    this.updateState({ tssShareIndex, tssPubKey, factorKey });

    // Finalize setup.
    if (!this.tKey.manualSync) await this.tKey.syncLocalMetadataTransitions();
    if (this.options.setupProviderOnInit) {
      await this.setupProvider({ chainConfig: this.options.chainConfig });
    }
    await this.createSession();
  }

  private checkReady() {
    if (!this.ready) {
      throw CoreKitError.mpcCoreKitNotInitialized();
    }
  }

  private async rehydrateSession(result: SessionData) {
    try {
      this.checkReady();

      const factorKey = new BN(result.factorKey, "hex");
      if (!factorKey) {
        throw CoreKitError.providedFactorKeyInvalid();
      }
      this.torusSp.postboxKey = new BN(result.oAuthKey, "hex");
      this.torusSp.verifierName = result.userInfo.aggregateVerifier || result.userInfo.verifier;
      this.torusSp.verifierId = result.userInfo.verifierId;
      this.torusSp.verifierType = result.userInfo.aggregateVerifier ? "aggregate" : "normal";
      const factorKeyMetadata = await this.getFactorKeyMetadata(factorKey);
      await this.tKey.initialize({ neverInitializeNewKey: true });
      await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
      await this.tKey.reconstructKey();

      this.updateState({
        factorKey: new BN(result.factorKey, "hex"),
        oAuthKey: result.oAuthKey,
        tssShareIndex: result.tssShareIndex,
        tssPubKey: Point.fromTkeyPoint(this.tkey.getTSSPub()).toBufferSEC1(false),
        signatures: result.signatures,
        userInfo: result.userInfo,
      });

      if (this.options.setupProviderOnInit) {
        await this.setupProvider({ chainConfig: this.options.chainConfig });
      }
    } catch (err) {
      log.error("error trying to authorize session", err);
    }
  }

  private async createSession() {
    try {
      const sessionId = OpenloginSessionManager.generateRandomSessionKey();
      this.sessionManager.sessionId = sessionId;
      const { oAuthKey, factorKey, userInfo, tssShareIndex, tssPubKey } = this.state;
      if (!this.state.factorKey) {
        throw CoreKitError.factorKeyNotPresent("factorKey not present in state when creating session.");
      }
      const { tssShare } = await this.tKey.getTSSShare(this.state.factorKey, {
        accountIndex: this.state.accountIndex,
      });
      if (!oAuthKey || !factorKey || !tssShare || !tssPubKey || !userInfo) {
        throw CoreKitError.userNotLoggedIn();
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
      // to accommodate async storage
      await this.currentStorage.set("sessionId", sessionId);
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
      throw CoreKitError.noMetadataFound();
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
      throw CoreKitError.factorPubsMissing("'factorPubs' is missing in the metadata. Failed to copy factor public key.");
    }
    if (!this.tKey.metadata.factorEncs || typeof this.tKey.metadata.factorEncs[this.tKey.tssTag] !== "object") {
      throw CoreKitError.factorEncsMissing("'factorEncs' is missing in the metadata. Failed to copy factor public key.");
    }
    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when copying or creating a share.");
    }
    if (VALID_SHARE_INDICES.indexOf(newFactorTSSIndex) === -1) {
      throw CoreKitError.newShareIndexInvalid(`Invalid share type provided (${newFactorTSSIndex}). Valid share types are ${VALID_SHARE_INDICES}.`);
    }

    if (this.tKey.metadata.factorPubs[this.tKey.tssTag].length >= MAX_FACTORS) {
      throw CoreKitError.maximumFactorsReached(`The maximum number of allowable factors (${MAX_FACTORS}) has been reached.`);
    }
    if (this.state.tssShareIndex !== newFactorTSSIndex) {
      // Generate new share.
      await addFactorAndRefresh(this.tKey, newFactorPub, newFactorTSSIndex, this.state.factorKey, this.signatures);

      // Update local share.
      const { tssIndex } = await this.tKey.getTSSShare(this.state.factorKey);
      this.updateState({
        tssShareIndex: tssIndex,
      });
      return;
    }

    const { tssShare } = await this.tKey.getTSSShare(this.state.factorKey);
    const updatedFactorPubs = this.tKey.metadata.factorPubs[this.tKey.tssTag].concat([newFactorPub]);
    const factorEncs = JSON.parse(JSON.stringify(this.tKey.metadata.factorEncs[this.tKey.tssTag]));
    const factorPubID = newFactorPub.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    factorEncs[factorPubID] = {
      tssIndex: this.state.tssShareIndex,
      type: "direct",
      userEnc: await encrypt(Point.fromTkeyPoint(newFactorPub).toBufferSEC1(false), scalarBNToBufferSEC1(tssShare)),
      serverEncs: [],
    };
    this.tKey.metadata.addTSSData({
      tssTag: this.tKey.tssTag,
      factorPubs: updatedFactorPubs,
      factorEncs,
    });

    if (!this.tKey.manualSync) await this.tKey._syncShareMetadata();
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
      if (!share) {
        throw CoreKitError.noMetadataShareFound();
      }
      return share;
    } catch (err: unknown) {
      log.error("create device share error", err);
      throw CoreKitError.default((err as Error).message);
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

  public async setupProvider(option: { chainConfig: CustomChainConfig }): Promise<void> {
    this.checkReady();
    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when setting up provider.");
    }

    this.options.chainConfig = option.chainConfig;
    const signingProvider = new EthereumSigningProvider({ config: { chainConfig: this.options.chainConfig } });
    await signingProvider.setupProvider({ sign: this.sign, getPublic: this.getPublic });

    if (this.providerProxy === null) {
      const provider = createSwappableProxy<SafeEventEmitterProvider>(signingProvider.provider);
      this.providerProxy = provider;
    } else {
      this.providerProxy.setTarget(signingProvider.provider);
    }
  }

  private updateState(newState: Partial<Web3AuthState>): void {
    this.state = { ...this.state, ...newState };
  }

  private resetState(): void {
    this.ready = false;
    this.tkey = null;
    this.torusSp = null;
    this.storageLayer = null;
    this.providerProxy = null;
  }

  private _getOAuthKey(result: TorusKey): string {
    return TorusUtils.getPostboxKey(result);
  }

  private _getSignatures(sessionData: TorusKey["sessionData"]["sessionTokenData"]): string[] {
    return sessionData.map((session) => JSON.stringify({ data: session.token, sig: session.signature }));
  }

  private async getSigningSignatures(data: string): Promise<string[]> {
    if (!this.signatures) {
      throw CoreKitError.signaturesNotPresent();
    }
    log.info("data", data);
    return this.signatures;
  }

  private isNodejsOrRN(params: CoreKitMode): boolean {
    const mode = params;
    return mode === "nodejs" || mode === "react-native";
  }

  private async featureRequest() {
    const accessUrl = SIGNER_MAP[this.options.web3AuthNetwork];

    const accessRequest = {
      network: this.options.web3AuthNetwork,
      client_id: this.options.web3AuthClientId,
      is_mpc_core_kit: "true",
      enable_gating: "true",
    };
    const url = new URL(`${accessUrl}/api/feature-access`);
    url.search = new URLSearchParams(accessRequest).toString();
    const result = await fetch(url);

    if (result.status !== 200) {
      // reset state on no mpc access
      this.resetState();
      const errMessage = (await result.json()) as { error: string };
      throw CoreKitError.default(errMessage.error);
    }
    return result.json();
  }

  private getNonce = () => {
    return this.tkey.computeAccountNonce(this.state.accountIndex);
  };
}
