import {
  BNString,
  KEY_NOT_FOUND,
  KeyType,
  ONE_KEY_DELETE_NONCE,
  Point,
  secp256k1,
  SHARE_DELETED,
  ShareStore,
  StringifiedType,
} from "@tkey/common-types";
import { CoreError } from "@tkey/core";
import { ShareSerializationModule } from "@tkey/share-serialization";
import { TorusStorageLayer } from "@tkey/storage-layer-torus";
import { factorKeyCurve, getPubKeyPoint, lagrangeInterpolation, TKeyTSS, TSSTorusServiceProvider } from "@tkey/tss";
import { KEY_TYPE, SIGNER_MAP } from "@toruslabs/constants";
import { AGGREGATE_VERIFIER, TORUS_METHOD, TorusAggregateLoginResponse, TorusLoginResponse, UX_MODE } from "@toruslabs/customauth";
import type { UX_MODE_TYPE } from "@toruslabs/customauth/dist/types/utils/enums";
import { Ed25519Curve } from "@toruslabs/elliptic-wrapper";
import { fetchLocalConfig } from "@toruslabs/fnd-base";
import { keccak256 } from "@toruslabs/metadata-helpers";
import { SessionManager } from "@toruslabs/session-manager";
import { Torus as TorusUtils, TorusKey } from "@toruslabs/torus.js";
import { Client, getDKLSCoeff, setupSockets } from "@toruslabs/tss-client";
import type { WasmLib as DKLSWasmLib } from "@toruslabs/tss-dkls-lib";
import { sign as signEd25519 } from "@toruslabs/tss-frost-client";
import type { WasmLib as FrostWasmLib } from "@toruslabs/tss-frost-lib";
import BN from "bn.js";
import bowser from "bowser";
import { ec as EC } from "elliptic";

import {
  Analytics,
  ANALYTICS_EVENTS,
  ANALYTICS_INTEGRATION_TYPE,
  ANALYTICS_SDK_NAME,
  ANALYTICS_SDK_VERSION,
  consumePendingConnectionTrackData,
  getErrorAnalyticsProperties,
  getInputFactorFailureReason,
  persistPendingConnectionTrackData,
} from "./analytics";
import {
  ERRORS,
  FactorKeyTypeShareDescription,
  FIELD_ELEMENT_HEX_LEN,
  MAX_FACTORS,
  SOCIAL_TKEY_INDEX,
  TssShareType,
  VALID_SHARE_INDICES,
  WEB3AUTH_NETWORK,
} from "./constants";
import { AsyncStorage } from "./helper/browserStorage";
import CoreKitError from "./helper/errors";
import {
  AggregateVerifierLoginParams,
  COREKIT_STATUS,
  CoreKitMode,
  CreateFactorParams,
  EnableMFAParams,
  ICoreKit,
  IFactorKey,
  InitParams,
  JWTLoginParams,
  MPCKeyDetails,
  OAuthLoginParams,
  PreSigningHookType,
  Secp256k1PrecomputedClient,
  SessionData,
  SubVerifierDetailsParams,
  TkeyLocalStoreData,
  TssLibType,
  UserInfo,
  V3TSSLibType,
  V4TSSLibType,
  Web3AuthOptions,
  Web3AuthOptionsWithDefaults,
  Web3AuthState,
} from "./interfaces";
import {
  deriveShareCoefficients,
  ed25519,
  generateEd25519Seed,
  generateFactorKey,
  generateSessionNonce,
  generateTSSEndpoints,
  getHashedPrivateKey,
  getSessionId,
  log,
  parseToken,
  sampleEndpoints,
  scalarBNToBufferSEC1,
} from "./utils";

export class Web3AuthMPCCoreKit implements ICoreKit {
  public state: Web3AuthState = { accountIndex: 0 };

  public torusSp: TSSTorusServiceProvider | null = null;

  private options: Web3AuthOptionsWithDefaults;

  private storageLayer: TorusStorageLayer | null = null;

  private tkey: TKeyTSS | null = null;

  private sessionManager?: SessionManager<SessionData>;

  private currentStorage: AsyncStorage;

  private _storageBaseKey = "corekit_store";

  private enableLogging = false;

  private ready = false;

  private _tssLib: TssLibType;

  private wasmLib: DKLSWasmLib | FrostWasmLib;

  private _keyType: KeyType;

  private atomicCallStackCounter: number = 0;

  private preSigningHook?: PreSigningHookType;

  private socketTransports: string[] = ["websocket", "polling"];

  private analytics: Analytics;

  private suppressFactorAnalytics = false;

  private skipInitAnalytics = false;

  constructor(options: Web3AuthOptions) {
    if (!options.web3AuthClientId) {
      throw CoreKitError.clientIdInvalid();
    }

    this._tssLib = options.tssLib;
    this._keyType = options.tssLib.keyType as KeyType;

    const isNodejsOrRN = this.isNodejsOrRN(options.uxMode);

    if (options.enableLogging) {
      log.enableAll();
      this.enableLogging = true;
    } else log.setLevel("error");
    if (typeof options.manualSync !== "boolean") options.manualSync = false;
    if (!options.web3AuthNetwork) options.web3AuthNetwork = WEB3AUTH_NETWORK.MAINNET;
    // if sessionTime is not provided, it is defaulted to 86400
    if (!options.sessionTime) options.sessionTime = 86400;
    if (!options.serverTimeOffset) options.serverTimeOffset = 0;
    if (!options.uxMode) options.uxMode = UX_MODE.REDIRECT;
    if (!options.redirectPathName) options.redirectPathName = "redirect";
    if (!options.baseUrl) options.baseUrl = isNodejsOrRN ? "https://localhost" : `${window?.location.origin}/serviceworker`;
    if (!options.disableHashedFactorKey) options.disableHashedFactorKey = false;
    if (!options.hashedFactorNonce) options.hashedFactorNonce = options.web3AuthClientId;
    if (options.disableSessionManager === undefined) options.disableSessionManager = false;
    if (options.disableAnalytics === undefined) options.disableAnalytics = false;
    if (options.socketTransports) this.socketTransports = options.socketTransports;
    this.options = options as Web3AuthOptionsWithDefaults;

    this.currentStorage = new AsyncStorage(this._storageBaseKey, options.storage);

    if (!options.disableSessionManager) {
      this.sessionManager = new SessionManager<SessionData>({
        sessionTime: options.sessionTime,
      });
    }

    this.analytics = new Analytics({
      disabled: options.disableAnalytics || isNodejsOrRN,
    });
    this.analytics.setGlobalProperties({
      integration_type: ANALYTICS_INTEGRATION_TYPE,
      dapp_url: typeof window === "undefined" ? undefined : window.location?.origin,
      sdk_name: ANALYTICS_SDK_NAME,
      sdk_version: ANALYTICS_SDK_VERSION,
      web3auth_client_id: this.options.web3AuthClientId,
      web3auth_network: this.options.web3AuthNetwork,
      auth_ux_mode: this.options.uxMode,
      key_type: this.keyType,
    });

    TorusUtils.setSessionTime(this.options.sessionTime);
  }

  get tKey(): TKeyTSS {
    if (this.tkey === null) {
      throw CoreKitError.tkeyInstanceUninitialized();
    }
    return this.tkey;
  }

  get keyType(): KeyType {
    return this._keyType;
  }

  get signatures(): string[] {
    return this.state?.signatures ? this.state.signatures : [];
  }

  public get _storageKey(): string {
    return this._storageBaseKey;
  }

  get status(): COREKIT_STATUS {
    try {
      // metadata will be present if tkey is initialized (1 share)
      // if 2 shares are present, then privKey will be present after metadatakey(tkey) reconstruction
      const { tkey } = this;
      if (!tkey) return COREKIT_STATUS.NOT_INITIALIZED;
      if (!tkey.metadata) return COREKIT_STATUS.INITIALIZED;
      if (!tkey.secp256k1Key || !this.state.factorKey) return COREKIT_STATUS.REQUIRED_SHARE;
      return COREKIT_STATUS.LOGGED_IN;
    } catch (e) {}
    return COREKIT_STATUS.NOT_INITIALIZED;
  }

  get sessionId(): string {
    return this.sessionManager?.sessionId;
  }

  get supportsAccountIndex(): boolean {
    return this._keyType !== KeyType.ed25519;
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

  private get useClientGeneratedTSSKey(): boolean {
    return this.keyType === KeyType.ed25519 && this.options.useClientGeneratedTSSKey === undefined ? true : !!this.options.useClientGeneratedTSSKey;
  }

  // RecoverTssKey only valid for user that enable MFA where user has 2 type shares :
  // TssShareType.DEVICE and TssShareType.RECOVERY
  // if the factors key provided is the same type recovery will not works
  public async _UNSAFE_recoverTssKey(factorKey: string[]) {
    this.checkReady();
    const factorKeyBN = new BN(factorKey[0], "hex");
    const shareStore0 = await this.getFactorKeyMetadata(factorKeyBN);
    await this.tKey.initialize({ withShare: shareStore0 });
    const tssShares: BN[] = [];
    const tssIndexes: number[] = [];
    const tssIndexesBN: BN[] = [];
    for (let i = 0; i < factorKey.length; i++) {
      const factorKeyBNInput = new BN(factorKey[i], "hex");
      const { tssIndex, tssShare } = await this.tKey.getTSSShare(factorKeyBNInput);
      if (tssIndexes.includes(tssIndex)) {
        // reset instance before throw error
        this.skipInitAnalytics = true;
        try {
          await this.init();
        } finally {
          this.skipInitAnalytics = false;
        }
        throw CoreKitError.duplicateTssIndex();
      }
      tssIndexes.push(tssIndex);
      tssIndexesBN.push(new BN(tssIndex));
      tssShares.push(tssShare);
    }

    const finalKey = lagrangeInterpolation(this.tkey.tssCurve, tssShares, tssIndexesBN);
    // reset instance after recovery completed
    this.skipInitAnalytics = true;
    try {
      await this.init();
    } finally {
      this.skipInitAnalytics = false;
    }
    return finalKey.toString("hex", 64);
  }

  public async init(params: InitParams = { handleRedirectResult: true }): Promise<void> {
    const startTime = Date.now();
    this.analytics.init();
    if (!this.skipInitAnalytics) {
      void this.analytics.identify(this.options.web3AuthClientId, {
        web3auth_client_id: this.options.web3AuthClientId,
        web3auth_network: this.options.web3AuthNetwork,
      });
    }
    let skipSdkInitializationFailed = false;

    try {
      this.resetState();
      if (params.rehydrate === undefined) params.rehydrate = true;

      const nodeDetails = fetchLocalConfig(this.options.web3AuthNetwork, this.keyType);

      if (this.keyType === KEY_TYPE.ED25519 && this.options.useDKG) {
        throw CoreKitError.invalidConfig("DKG is not supported for ed25519 key type");
      }

      this.torusSp = new TSSTorusServiceProvider({
        customAuthArgs: {
          web3AuthClientId: this.options.web3AuthClientId,
          baseUrl: this.options.baseUrl,
          uxMode: this.isNodejsOrRN(this.options.uxMode) ? UX_MODE.REDIRECT : (this.options.uxMode as UX_MODE_TYPE),
          network: this.options.web3AuthNetwork,
          redirectPathName: this.options.redirectPathName,
          locationReplaceOnRedirect: true,
          serverTimeOffset: this.options.serverTimeOffset,
          keyType: this.keyType,
          useDkg: this.options.useDKG,
        },
      });

      this.storageLayer = new TorusStorageLayer({
        hostUrl: `${new URL(nodeDetails.torusNodeEndpoints[0]).origin}/metadata`,
        enableLogging: this.enableLogging,
      });

      const shareSerializationModule = new ShareSerializationModule();

      this.tkey = new TKeyTSS({
        enableLogging: this.enableLogging,
        serviceProvider: this.torusSp,
        storageLayer: this.storageLayer,
        manualSync: this.options.manualSync,
        modules: {
          shareSerialization: shareSerializationModule,
        },
        tssKeyType: this.keyType,
      });

      if (this.isRedirectMode) {
        await this.torusSp.init({ skipSw: true, skipPrefetch: true });
      } else if (this.options.uxMode === UX_MODE.POPUP) {
        await this.torusSp.init({});
      }

      this.ready = true;

      // try handle redirect flow if enabled and return(redirect) from oauth login
      if (
        params.handleRedirectResult &&
        this.options.uxMode === UX_MODE.REDIRECT &&
        (window?.location.hash.includes("#state") || window?.location.hash.includes("#access_token"))
      ) {
        // on failed redirect, instance is reseted.
        // skip check feature gating on redirection as it was check before login
        // Connection Started/Completed/Failed are tracked inside handleRedirectResult.
        // Login errors from redirect must not also count as SDK initialization failures.
        try {
          await this.handleRedirectResult();
        } catch (error) {
          skipSdkInitializationFailed = true;
          throw error;
        }
        this.trackInitializationCompleted(startTime, { session_rehydration: "skipped" });

        // return early on successful redirect, the rest of the code will not be executed
        return;
      } else if (params.rehydrate && this.sessionManager) {
        // if not redirect flow try to rehydrate session if available
        const sessionId = await this.currentStorage.get<string>("sessionId");
        if (sessionId) {
          this.sessionManager.sessionId = sessionId;
          const rehydrationStartTime = Date.now();

          // swallowed, should not throw on rehydrate timed out session
          const sessionResult = await this.sessionManager.authorizeSession().catch(async (err) => {
            log.error("rehydrate session error", err);
            void this.analytics.track(ANALYTICS_EVENTS.SESSION_REHYDRATION_FAILED, {
              ...getErrorAnalyticsProperties(err),
              duration: Date.now() - rehydrationStartTime,
            });
          });

          // try rehydrate session
          if (sessionResult) {
            const rehydrated = await this.rehydrateSession(sessionResult);
            this.trackInitializationCompleted(startTime, { session_rehydration: rehydrated ? "completed" : "failed" });

            // return early whether rehydrate succeeded or swallowed an error
            return;
          }

          await this.featureRequest();
          this.trackInitializationCompleted(startTime, { session_rehydration: "failed" });
          return;
        }
      }
      // feature gating if not redirect flow or session rehydration
      await this.featureRequest();
      this.trackInitializationCompleted(startTime, { session_rehydration: "skipped" });
    } catch (error) {
      if (!this.skipInitAnalytics && !skipSdkInitializationFailed) {
        void this.analytics.track(ANALYTICS_EVENTS.SDK_INITIALIZATION_FAILED, {
          ...this.getInitializationTrackData(),
          ...getErrorAnalyticsProperties(error),
          duration: Date.now() - startTime,
        });
      }
      throw error;
    }
  }

  public async loginWithOAuth(params: OAuthLoginParams): Promise<void> {
    this.checkReady();
    if (this.isNodejsOrRN(this.options.uxMode)) {
      throw CoreKitError.oauthLoginUnsupported(`Oauth login is NOT supported in ${this.options.uxMode} mode.`);
    }

    if (this.state.factorKey) {
      throw CoreKitError.oauthLoginUnsupported("Instance is already logged in or rehydrated");
    }

    const { importTssKey, registerExistingSFAKey } = params;
    const tkeyServiceProvider = this.torusSp;

    if (registerExistingSFAKey && importTssKey) {
      throw CoreKitError.invalidConfig("Cannot import TSS key and register SFA key at the same time.");
    }

    if (this.isRedirectMode && (importTssKey || registerExistingSFAKey)) {
      throw CoreKitError.invalidConfig("key import is not supported in redirect mode");
    }
    const startTime = Date.now();
    const trackData = this.getConnectionTrackData(params);
    // Redirect unloads the page before Segment can reliably send. Persist the
    // connection properties so handleRedirectResult can emit Connection Started with
    // the same verifier / auth_connection. If triggerLogin throws before unload,
    // emit start here so Connection Failed still has a matching funnel start.
    if (this.isRedirectMode) {
      persistPendingConnectionTrackData(trackData);
    } else {
      void this.analytics.track(ANALYTICS_EVENTS.CONNECTION_STARTED, trackData);
    }
    try {
      // oAuth login.
      const verifierParams = params as SubVerifierDetailsParams;
      const aggregateParams = params as AggregateVerifierLoginParams;
      let loginResponse: TorusLoginResponse | TorusAggregateLoginResponse;
      if (verifierParams.subVerifierDetails) {
        // single verifier login.
        loginResponse = await tkeyServiceProvider.triggerLogin((params as SubVerifierDetailsParams).subVerifierDetails);

        if (this.isRedirectMode) return;

        this.updateState({
          postBoxKey: this._getPostBoxKey(loginResponse),
          postboxKeyNodeIndexes: loginResponse.nodesData?.nodeIndexes,
          userInfo: loginResponse.userInfo,
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
      } else if (aggregateParams.subVerifierDetailsArray) {
        loginResponse = await tkeyServiceProvider.triggerAggregateLogin({
          aggregateVerifierType: aggregateParams.aggregateVerifierType || AGGREGATE_VERIFIER.SINGLE_VERIFIER_ID,
          verifierIdentifier: aggregateParams.aggregateVerifierIdentifier as string,
          subVerifierDetailsArray: aggregateParams.subVerifierDetailsArray,
        });

        if (this.isRedirectMode) return;

        this.updateState({
          postBoxKey: this._getPostBoxKey(loginResponse),
          postboxKeyNodeIndexes: loginResponse.nodesData?.nodeIndexes,
          userInfo: loginResponse.userInfo[0],
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
      }

      if (loginResponse && registerExistingSFAKey && loginResponse.finalKeyData.privKey) {
        if (loginResponse.metadata.typeOfUser === "v1") {
          throw CoreKitError.invalidConfig("Cannot register existing SFA key for v1 users, please contact web3auth support.");
        }
        const existingSFAKey = loginResponse.finalKeyData.privKey.padStart(64, "0");
        await this.setupTkey(existingSFAKey, loginResponse, true);
      } else {
        await this.setupTkey(importTssKey, loginResponse, false);
      }
      this.trackConnectionOutcome(startTime, trackData);
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) {
          if (this.isRedirectMode) {
            consumePendingConnectionTrackData();
            void this.analytics.track(ANALYTICS_EVENTS.CONNECTION_STARTED, trackData);
          }
          this.trackRequiredShare(startTime, trackData);
          throw CoreKitError.default(ERRORS.TKEY_SHARES_REQUIRED);
        }
      }
      if (this.isRedirectMode) {
        consumePendingConnectionTrackData();
        void this.analytics.track(ANALYTICS_EVENTS.CONNECTION_STARTED, trackData);
      }
      void this.analytics.track(ANALYTICS_EVENTS.CONNECTION_FAILED, {
        ...trackData,
        ...getErrorAnalyticsProperties(err),
        duration: Date.now() - startTime,
      });
      throw CoreKitError.default((err as Error).message);
    }
  }

  public async loginWithJWT(params: JWTLoginParams): Promise<void> {
    this.checkReady();

    if (this.state.factorKey) {
      throw CoreKitError.oauthLoginUnsupported("Instance is already logged in or rehydrated");
    }

    const { prefetchTssPublicKeys = 1 } = params;
    if (prefetchTssPublicKeys > 3) {
      throw CoreKitError.prefetchValueExceeded(`The prefetch value '${prefetchTssPublicKeys}' exceeds the maximum allowed limit of 3.`);
    }

    const { verifier, verifierId, idToken, importTssKey, registerExistingSFAKey } = params;
    this.torusSp.verifierName = verifier;
    this.torusSp.verifierId = verifierId;

    if (registerExistingSFAKey && importTssKey) {
      throw CoreKitError.invalidConfig("Cannot import TSS key and register SFA key at the same time.");
    }

    const startTime = Date.now();
    const trackData = this.getJWTTrackData(params);
    void this.analytics.track(ANALYTICS_EVENTS.CONNECTION_STARTED, trackData);
    try {
      // prefetch tss pub keys.
      const prefetchTssPubs = [];
      for (let i = 0; i < prefetchTssPublicKeys; i++) {
        prefetchTssPubs.push(this.torusSp.getTSSPubKey(this.tkey.tssTag, i));
      }

      // get postbox key.
      let loginPromise: Promise<TorusKey>;
      if (!params.subVerifier) {
        // single verifier login.
        loginPromise = this.torusSp.customAuthInstance.getTorusKey(verifier, verifierId, { verifier_id: verifierId }, idToken, {
          ...params.extraVerifierParams,
          ...params.additionalParams,
        });
      } else {
        // aggregate verifier login
        loginPromise = this.torusSp.customAuthInstance.getAggregateTorusKey(verifier, verifierId, [
          { verifier: params.subVerifier, idToken, extraVerifierParams: params.extraVerifierParams },
        ]);
      }

      // wait for prefetch completed before setup tkey
      const [loginResponse] = await Promise.all([loginPromise, ...prefetchTssPubs]);

      const postBoxKey = this._getPostBoxKey(loginResponse);

      this.torusSp.postboxKey = new BN(postBoxKey, "hex");

      this.updateState({
        postBoxKey,
        postboxKeyNodeIndexes: loginResponse.nodesData?.nodeIndexes || [],
        userInfo: { ...parseToken(idToken), verifier, verifierId },
        signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
      });
      if (registerExistingSFAKey && loginResponse.finalKeyData.privKey) {
        if (loginResponse.metadata.typeOfUser === "v1") {
          throw CoreKitError.invalidConfig("Cannot register existing SFA key for v1 users, please contact web3auth support.");
        }
        const existingSFAKey = loginResponse.finalKeyData.privKey.padStart(64, "0");
        await this.setupTkey(existingSFAKey, loginResponse, true);
      } else {
        await this.setupTkey(importTssKey, loginResponse, false);
      }
      this.trackConnectionOutcome(startTime, trackData);
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) {
          this.trackRequiredShare(startTime, trackData);
          const newError = CoreKitError.default(ERRORS.TKEY_SHARES_REQUIRED);
          newError.stack = err.stack;
          throw newError;
        }
      }
      void this.analytics.track(ANALYTICS_EVENTS.CONNECTION_FAILED, {
        ...trackData,
        ...getErrorAnalyticsProperties(err),
        duration: Date.now() - startTime,
      });
      const newError = CoreKitError.default((err as Error).message);
      newError.stack = (err as Error).stack;
      throw newError;
    }
  }

  setPreSigningHook(preSigningHook: PreSigningHookType) {
    this.preSigningHook = preSigningHook;
  }

  public async handleRedirectResult(): Promise<void> {
    this.checkReady();
    const startTime = Date.now();
    let connectionTrackData: Record<string, unknown> = {
      ...consumePendingConnectionTrackData(),
      login_method: "redirect",
    };
    void this.analytics.track(ANALYTICS_EVENTS.CONNECTION_STARTED, connectionTrackData);

    try {
      const result = await this.torusSp.customAuthInstance.getRedirectResult();
      let loginResponse: TorusLoginResponse | TorusAggregateLoginResponse;
      if (result.method === TORUS_METHOD.TRIGGER_LOGIN) {
        loginResponse = result.result as TorusLoginResponse;
        if (!loginResponse) {
          throw CoreKitError.invalidTorusLoginResponse();
        }
        this.updateState({
          postBoxKey: this._getPostBoxKey(loginResponse),
          postboxKeyNodeIndexes: loginResponse.nodesData?.nodeIndexes || [],
          userInfo: loginResponse.userInfo,
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.verifier;
      } else if (result.method === TORUS_METHOD.TRIGGER_AGGREGATE_LOGIN) {
        loginResponse = result.result as TorusAggregateLoginResponse;
        if (!loginResponse) {
          throw CoreKitError.invalidTorusAggregateLoginResponse();
        }
        this.updateState({
          postBoxKey: this._getPostBoxKey(loginResponse),
          postboxKeyNodeIndexes: loginResponse.nodesData?.nodeIndexes || [],
          userInfo: loginResponse.userInfo[0],
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.aggregateVerifier;
      } else {
        throw CoreKitError.unsupportedRedirectMethod();
      }

      const userInfo = this.getUserInfo();
      connectionTrackData = this.enrichRedirectConnectionTrackData(connectionTrackData, userInfo);
      if (!this.state.postBoxKey) {
        throw CoreKitError.postBoxKeyMissing("postBoxKey not present in state after processing redirect result.");
      }
      this.torusSp.postboxKey = new BN(this.state.postBoxKey, "hex");
      this.torusSp.verifierId = userInfo.verifierId;
      await this.setupTkey();
      this.trackConnectionOutcome(startTime, connectionTrackData);
    } catch (error: unknown) {
      const { userInfo } = this.state;
      connectionTrackData = this.enrichRedirectConnectionTrackData(connectionTrackData, userInfo);
      const isRequiredShare = error instanceof CoreError && error.code === 1302;
      if (isRequiredShare) {
        this.trackRequiredShare(startTime, connectionTrackData);
      }
      this.resetState();
      log.error("error while handling redirect result", error);
      if (!isRequiredShare) {
        void this.analytics.track(ANALYTICS_EVENTS.CONNECTION_FAILED, {
          ...connectionTrackData,
          ...getErrorAnalyticsProperties(error),
          duration: Date.now() - startTime,
        });
      }
      throw CoreKitError.default((error as Error).message);
    }
  }

  public async inputFactorKey(factorKey: BN): Promise<void> {
    this.checkReady();
    const startTime = Date.now();
    const completesLogin = this.status === COREKIT_STATUS.REQUIRED_SHARE;
    if (!this.suppressFactorAnalytics) void this.analytics.track(ANALYTICS_EVENTS.INPUT_FACTOR_STARTED);
    try {
      // always check for valid factor key
      let factorPubX: string;
      try {
        const factorKeyPrivate = factorKeyCurve.keyFromPrivate(factorKey.toBuffer());
        factorPubX = factorKeyPrivate.getPublic().getX().toString("hex").padStart(64, "0");
      } catch {
        throw CoreKitError.providedFactorKeyInvalid("Invalid FactorKey provided. Failed to derive its public key.");
      }
      const factorEncExist = this.tkey.metadata.factorEncs?.[this.tkey.tssTag]?.[factorPubX];
      if (!factorEncExist) {
        throw CoreKitError.providedFactorKeyInvalid("Invalid FactorKey provided. Failed to input factor key.");
      }

      // input tkey device share when required share > 0 ( or tkey is not yet reconstructed )
      // assumption tkey shares will never changed
      if (!this.tKey.secp256k1Key) {
        const factorKeyMetadata = await this.getFactorKeyMetadata(factorKey);
        await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
      }

      // Finalize initialization.
      await this.tKey.reconstructKey();
      await this.finalizeTkey(factorKey);
      if (!this.suppressFactorAnalytics) {
        void this.analytics.track(ANALYTICS_EVENTS.INPUT_FACTOR_COMPLETED, {
          factor_share_type: this.state.tssShareIndex,
          duration: Date.now() - startTime,
        });
      }
      if (completesLogin && !this.suppressFactorAnalytics) {
        void this.analytics.track(ANALYTICS_EVENTS.CONNECTION_COMPLETED, {
          completion_method: "input_factor",
          factor_share_type: this.state.tssShareIndex,
          duration: Date.now() - startTime,
        });
      }
    } catch (err: unknown) {
      log.error("login error", err);
      if (!this.suppressFactorAnalytics) {
        void this.analytics.track(ANALYTICS_EVENTS.INPUT_FACTOR_FAILED, {
          failure_reason: getInputFactorFailureReason(err),
          ...getErrorAnalyticsProperties(err),
          duration: Date.now() - startTime,
        });
      }
      if (err instanceof CoreError) {
        if (err.code === 1302) {
          throw CoreKitError.default(ERRORS.TKEY_SHARES_REQUIRED);
        }
      }
      throw CoreKitError.default((err as Error).message);
    }
  }

  public setTssWalletIndex(accountIndex: number) {
    this.updateState({ tssPubKey: this.tKey.getTSSPub(accountIndex).toSEC1(this.tkey.tssCurve, false), accountIndex });
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

  public async enableMFA(enableMFAParams: EnableMFAParams, recoveryFactor = true): Promise<string | undefined> {
    this.checkReady();
    const startTime = Date.now();
    let mutationStarted = false;
    void this.analytics.track(ANALYTICS_EVENTS.MFA_ENABLEMENT_STARTED, {
      auth_ux_mode: this.options.uxMode,
      recovery_factor_enabled: recoveryFactor,
    });

    try {
      const { postBoxKey } = this.state;
      const hashedFactorKey = getHashedPrivateKey(postBoxKey, this.options.hashedFactorNonce);
      if (!(await this.checkIfFactorKeyValid(hashedFactorKey))) {
        if (this.tKey._localMetadataTransitions[0].length) {
          throw CoreKitError.commitChangesBeforeMFA();
        }
        throw CoreKitError.mfaAlreadyEnabled();
      }

      mutationStarted = true;
      this.suppressFactorAnalytics = true;
      const backupFactorKey = await this.atomicSync(async () => {
        let browserData;

        if (this.isNodejsOrRN(this.options.uxMode)) {
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
        await this.setDeviceFactor(deviceFactorKey);
        await this.inputFactorKey(new BN(deviceFactorKey, "hex"));

        const hashedFactorPub = getPubKeyPoint(hashedFactorKey, factorKeyCurve);
        await this.deleteFactor(hashedFactorPub, hashedFactorKey);

        // only recovery factor = true
        let recoveryFactorKey: string | undefined;
        if (recoveryFactor) {
          recoveryFactorKey = await this.createFactor({ shareType: TssShareType.RECOVERY, ...enableMFAParams });
        }

        return recoveryFactorKey;
      });
      this.suppressFactorAnalytics = false;
      void this.analytics.track(ANALYTICS_EVENTS.MFA_ENABLEMENT_COMPLETED, {
        auth_ux_mode: this.options.uxMode,
        is_mfa_enabled: true,
        recovery_factor_created: Boolean(backupFactorKey),
        duration: Date.now() - startTime,
      });
      return backupFactorKey;
    } catch (reason) {
      this.suppressFactorAnalytics = false;
      const error = reason as Error;
      log.error("error enabling MFA:", error.message);
      void this.analytics.track(ANALYTICS_EVENTS.MFA_ENABLEMENT_FAILED, {
        auth_ux_mode: this.options.uxMode,
        ...getErrorAnalyticsProperties(reason),
        duration: Date.now() - startTime,
      });
      if (!mutationStarted) throw reason;
      const err = CoreKitError.default(error.message);
      err.stack = error.stack;
      throw err;
    }
  }

  public getTssFactorPub = (): string[] => {
    this.checkReady();
    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when getting tss factor public key.");
    }
    const factorPubsList = this.tKey.metadata.factorPubs[this.tKey.tssTag];
    return factorPubsList.map((factorPub) => factorPub.toSEC1(factorKeyCurve, true).toString("hex"));
  };

  // mutation function
  public async createFactor(createFactorParams: CreateFactorParams): Promise<string> {
    this.checkReady();
    const startTime = Date.now();
    const { shareType } = createFactorParams;
    const shareDescription = createFactorParams.shareDescription || FactorKeyTypeShareDescription.Other;
    let mutationStarted = false;

    try {
      let { factorKey, additionalMetadata } = createFactorParams;

      if (!VALID_SHARE_INDICES.includes(shareType)) {
        throw CoreKitError.newShareIndexInvalid(`Invalid share type provided (${shareType}). Valid share types are ${VALID_SHARE_INDICES}.`);
      }
      if (!factorKey) {
        factorKey = generateFactorKey().private;
      }
      if (!additionalMetadata) {
        additionalMetadata = {};
      }

      const factorPub = getPubKeyPoint(factorKey, factorKeyCurve);

      if (this.getTssFactorPub().includes(factorPub.toSEC1(factorKeyCurve, true).toString("hex"))) {
        throw CoreKitError.factorKeyAlreadyExists();
      }

      mutationStarted = true;
      const result = await this.atomicSync(async () => {
        await this.copyOrCreateShare(shareType, factorPub);
        await this.backupMetadataShare(factorKey);
        await this.addFactorDescription({ factorKey, shareDescription, additionalMetadata, updateMetadata: false });

        return scalarBNToBufferSEC1(factorKey).toString("hex");
      });
      if (!this.suppressFactorAnalytics) {
        void this.analytics.track(ANALYTICS_EVENTS.FACTOR_CREATION_COMPLETED, {
          factor_share_type: shareType,
          share_description: shareDescription,
          duration: Date.now() - startTime,
        });
      }
      return result;
    } catch (reason) {
      const error = reason as Error;
      log.error("error creating factor:", error.message);
      if (!this.suppressFactorAnalytics) {
        void this.analytics.track(ANALYTICS_EVENTS.FACTOR_CREATION_FAILED, {
          factor_share_type: shareType,
          share_description: shareDescription,
          ...getErrorAnalyticsProperties(reason),
          duration: Date.now() - startTime,
        });
      }
      if (!mutationStarted) throw reason;
      const err = CoreKitError.default(`error creating factor: ${error.message}`);
      err.stack = error.stack;
      throw err;
    }
  }

  /**
   * Get public key point in SEC1 format.
   */
  public getPubKey(): Buffer {
    const { tssPubKey } = this.state;
    if (!tssPubKey) {
      throw CoreKitError.tssPublicKeyOrEndpointsMissing("tssPubKey not present in state when getting public key.");
    }
    return Buffer.from(tssPubKey);
  }

  /**
   * Get public key point.
   */
  public getPubKeyPoint(): Point {
    const { tssPubKey } = this.state;
    if (!tssPubKey) {
      throw CoreKitError.tssPublicKeyOrEndpointsMissing("tssPubKey not present in state when getting public key point.");
    }
    return Point.fromSEC1(this.tkey.tssCurve, tssPubKey.toString("hex"));
  }

  /**
   * Get public key in ed25519 format.
   *
   * Throws an error if keytype is not compatible with ed25519.
   */
  public getPubKeyEd25519(): Buffer {
    const p = this.tkey.tssCurve.keyFromPublic(this.getPubKey()).getPublic();
    return ed25519().keyFromPublic(p).getPublic();
  }

  public async precompute_secp256k1(): Promise<{
    client: Client;
    serverCoeffs: Record<string, string>;
  }> {
    this.wasmLib = await this.loadTssWasm();
    // PreSetup
    const { tssShareIndex } = this.state;
    const tssPubKey = this.getPubKeyPoint();

    const { torusNodeTSSEndpoints } = fetchLocalConfig(this.options.web3AuthNetwork, this.keyType);

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

    // session is needed for authentication to the web3auth infrastructure holding the factor 1
    const randomSessionNonce = generateSessionNonce();
    const currentSession = getSessionId(this.verifier, this.verifierId, this.tKey.tssTag, tssNonce, randomSessionNonce);

    const parties = 4;
    const clientIndex = parties - 1;
    // 1. setup
    // generate endpoints for servers
    const { nodeIndexes } = await this.torusSp.getTSSPubKey(this.tKey.tssTag, this.tKey.metadata.tssNonces[this.tKey.tssTag]);
    const {
      endpoints,
      tssWSEndpoints,
      partyIndexes,
      nodeIndexesReturned: participatingServerDKGIndexes,
    } = generateTSSEndpoints(torusNodeTSSEndpoints, parties, clientIndex, nodeIndexes);

    // Setup sockets.
    const sockets = await setupSockets(tssWSEndpoints, randomSessionNonce, "/tss/socket.io", this.socketTransports);

    const dklsCoeff = getDKLSCoeff(true, participatingServerDKGIndexes, tssShareIndex);
    const denormalisedShare = dklsCoeff.mul(tssShare).umod(secp256k1.curve.n);
    const accountNonce = this.tkey.computeAccountNonce(this.state.accountIndex);
    const derivedShare = denormalisedShare.add(accountNonce).umod(secp256k1.curve.n);
    const share = scalarBNToBufferSEC1(derivedShare).toString("base64");

    if (!currentSession) {
      throw CoreKitError.activeSessionNotFound();
    }

    const { signatures } = this;
    if (!signatures) {
      throw CoreKitError.signaturesNotPresent();
    }

    // Client lib expects pub key in XY-format, base64-encoded.
    const tssPubKeyBase64 = Buffer.from(tssPubKey.toSEC1(secp256k1).subarray(1)).toString("base64");

    const client = new Client(
      currentSession,
      clientIndex,
      partyIndexes,
      endpoints,
      sockets,
      share,
      tssPubKeyBase64,
      true,
      this.wasmLib as DKLSWasmLib
    );

    const serverCoeffs: Record<number, string> = {};
    for (let i = 0; i < participatingServerDKGIndexes.length; i++) {
      const serverIndex = participatingServerDKGIndexes[i];
      serverCoeffs[serverIndex] = getDKLSCoeff(false, participatingServerDKGIndexes, tssShareIndex as number, serverIndex).toString("hex");
    }
    client.precompute({ signatures, server_coeffs: serverCoeffs, nonce: scalarBNToBufferSEC1(this.getAccountNonce()).toString("base64") });
    await client.ready().catch((err) => {
      client.cleanup({ signatures, server_coeffs: serverCoeffs });
      throw err;
    });
    return {
      client,
      serverCoeffs,
    };
  }

  public async sign(data: Buffer, hashed: boolean = false, secp256k1Precompute?: Secp256k1PrecomputedClient): Promise<Buffer> {
    if (this.preSigningHook) {
      const result = await this.preSigningHook({ data: Uint8Array.from(data), hashed });
      if (!result.success || result.error) {
        throw Error(result.error || "preSigningValidator failed");
      }
    }
    this.wasmLib = await this.loadTssWasm();
    if (this.keyType === KeyType.secp256k1) {
      const sig = await this.sign_ECDSA_secp256k1(data, hashed, secp256k1Precompute);
      return Buffer.concat([sig.r, sig.s, Buffer.from([sig.v])]);
    } else if (this.keyType === KeyType.ed25519) {
      return this.sign_ed25519(data, hashed);
    }
    throw CoreKitError.default(`sign not supported for key type ${this.keyType}`);
  }

  // mutation function
  async deleteFactor(factorPub: Point, factorKey?: BNString): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.state.factorKey) {
        throw CoreKitError.factorKeyNotPresent("factorKey not present in state when deleting a factor.");
      }
      if (!this.tKey.metadata.factorPubs) {
        throw CoreKitError.factorPubsMissing();
      }

      await this.atomicSync(async () => {
        const remainingFactors = this.tKey.metadata.factorPubs[this.tKey.tssTag].length || 0;
        if (remainingFactors <= 1) {
          throw CoreKitError.cannotDeleteLastFactor("Cannot delete last factor");
        }
        const fpp = factorPub;
        const stateFpp = getPubKeyPoint(this.state.factorKey, factorKeyCurve);
        if (fpp.equals(stateFpp)) {
          throw CoreKitError.factorInUseCannotBeDeleted("Cannot delete current active factor");
        }

        await this.tKey.deleteFactorPub({ factorKey: this.state.factorKey, deleteFactorPub: factorPub, authSignatures: this.signatures });
        const factorPubHex = fpp.toSEC1(factorKeyCurve, true).toString("hex");
        const allDesc = this.tKey.metadata.getShareDescription();
        const keyDesc = allDesc[factorPubHex];
        if (keyDesc) {
          await Promise.all(keyDesc.map(async (desc) => this.tKey?.metadata.deleteShareDescription(factorPubHex, desc)));
        }

        // delete factorKey share metadata if factorkey is provided
        if (factorKey) {
          const factorKeyBN = new BN(factorKey, "hex");
          const derivedFactorPub = getPubKeyPoint(factorKeyBN, factorKeyCurve);
          // only delete if factorPub matches
          if (derivedFactorPub.equals(fpp)) {
            await this.deleteMetadataShareBackup(factorKeyBN);
          }
        }
      });
      if (!this.suppressFactorAnalytics) {
        void this.analytics.track(ANALYTICS_EVENTS.FACTOR_DELETION_COMPLETED, { duration: Date.now() - startTime });
      }
    } catch (error) {
      if (!this.suppressFactorAnalytics) {
        void this.analytics.track(ANALYTICS_EVENTS.FACTOR_DELETION_FAILED, {
          ...getErrorAnalyticsProperties(error),
          duration: Date.now() - startTime,
        });
      }
      throw error;
    }
  }

  public async logout(): Promise<void> {
    const startTime = Date.now();
    try {
      if (this.sessionManager?.sessionId) {
        await this.sessionManager.invalidateSession();
      }
      // to accommodate async storage
      await this.currentStorage.set("sessionId", "");

      this.resetState();
      this.skipInitAnalytics = true;
      try {
        await this.init({ handleRedirectResult: false, rehydrate: false });
      } finally {
        this.skipInitAnalytics = false;
      }
      void this.analytics.track(ANALYTICS_EVENTS.LOGOUT_COMPLETED, { duration: Date.now() - startTime });
    } catch (error) {
      void this.analytics.track(ANALYTICS_EVENTS.LOGOUT_FAILED, {
        ...getErrorAnalyticsProperties(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
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
    const tssPubKey = this.state.tssPubKey ? Point.fromSEC1(this.tkey.tssCurve, this.state.tssPubKey.toString("hex")) : undefined;

    const factors = this.tKey.metadata.factorPubs ? this.tKey.metadata.factorPubs[this.tKey.tssTag] : [];
    const keyDetails: MPCKeyDetails = {
      // use tkey's for now
      requiredFactors: tkeyDetails.requiredShares,
      threshold: tkeyDetails.threshold,
      totalFactors: factors.length + 1,
      shareDescriptions: this.tKey.getMetadata().getShareDescription(),
      metadataPubKey: tkeyDetails.pubKey,
      tssPubKey,
      keyType: this.keyType,
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

  // device factor
  public async setDeviceFactor(factorKey: BN, replace = false): Promise<void> {
    if (!replace) {
      const existingFactor = await this.getDeviceFactor();
      if (existingFactor) {
        throw CoreKitError.default("Device factor already exists");
      }
    }

    const metadata = this.tKey.getMetadata();
    const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    await this.currentStorage.set(
      tkeyPubX,
      JSON.stringify({
        factorKey: factorKey.toString("hex").padStart(64, "0"),
      } as TkeyLocalStoreData)
    );
  }

  public async getDeviceFactor(): Promise<string | undefined> {
    const metadata = this.tKey.getMetadata();

    const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    const tKeyLocalStoreString = await this.currentStorage.get<string>(tkeyPubX);
    const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}") as TkeyLocalStoreData;
    return tKeyLocalStore.factorKey;
  }

  /**
   * WARNING: Use with caution. This will export the private signing key.
   *
   * Exports the private key scalar for the current account index.
   *
   * For keytype ed25519, consider using _UNSAFE_exportTssEd25519Seed.
   */
  public async _UNSAFE_exportTssKey(): Promise<string> {
    if (this.keyType !== KeyType.secp256k1) {
      throw CoreKitError.default("Wrong KeyType. Method can only be used when KeyType is secp256k1");
    }
    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when exporting tss key.");
    }
    if (!this.state.signatures) {
      throw CoreKitError.signaturesNotPresent("Signatures not present in state when exporting tss key.");
    }

    const exportTssKey0 = await this.tKey._UNSAFE_exportTssKey({
      factorKey: this.state.factorKey,
      authSignatures: this.state.signatures,
    });

    const accountNonce = this.getAccountNonce();
    const tssKey = exportTssKey0.add(accountNonce).umod(this.tKey.tssCurve.n);

    return tssKey.toString("hex", FIELD_ELEMENT_HEX_LEN);
  }

  /**
   * WARNING: Use with caution. This will export the private signing key.
   *
   * Attempts to export the ed25519 private key seed. Only works if import key
   * flow has been used.
   */
  public async _UNSAFE_exportTssEd25519Seed(): Promise<Buffer> {
    if (this.keyType !== KeyType.ed25519) {
      throw CoreKitError.default("Wrong KeyType. Method can only be used when KeyType is ed25519");
    }
    if (!this.state.factorKey) throw CoreKitError.factorKeyNotPresent("factorKey not present in state when exporting tss ed25519 seed.");
    if (!this.state.signatures) throw CoreKitError.signaturesNotPresent("Signatures not present in state when exporting tss ed25519 seed.");

    try {
      const exportEd25519Seed = await this.tKey._UNSAFE_exportTssEd25519Seed({
        factorKey: this.state.factorKey,
        authSignatures: this.state.signatures,
      });

      return exportEd25519Seed;
    } catch (error: unknown) {
      throw CoreKitError.default(`Error exporting ed25519 seed: ${error}`);
    }
  }

  public updateState(newState: Partial<Web3AuthState>): void {
    this.state = { ...this.state, ...newState };
  }

  protected async atomicSync<T>(f: () => Promise<T>): Promise<T> {
    this.atomicCallStackCounter += 1;

    this.tkey.manualSync = true;
    try {
      const r = await f();
      if (this.atomicCallStackCounter === 1) {
        if (!this.options.manualSync) {
          await this.commitChanges();
        }
      }
      return r;
    } catch (error) {
      throw error as Error;
    } finally {
      this.atomicCallStackCounter -= 1;
      if (this.atomicCallStackCounter === 0) {
        this.tkey.manualSync = this.options.manualSync;
      }
    }
  }

  private async importTssKey(tssKey: string, factorPub: Point, newTSSIndex: TssShareType = TssShareType.DEVICE): Promise<void> {
    if (!this.state.signatures) {
      throw CoreKitError.signaturesNotPresent("Signatures not present in state when importing tss key.");
    }

    await this.tKey.importTssKey(
      { tag: this.tKey.tssTag, importKey: Buffer.from(tssKey, "hex"), factorPub, newTSSIndex },
      { authSignatures: this.state.signatures }
    );
  }

  private getTssNonce(): number {
    if (!this.tKey.metadata.tssNonces || this.tKey.metadata.tssNonces[this.tKey.tssTag] === undefined) {
      throw CoreKitError.tssNoncesMissing(`tssNonce not present for tag ${this.tKey.tssTag}`);
    }
    const tssNonce = this.tKey.metadata.tssNonces[this.tKey.tssTag];
    return tssNonce;
  }

  private async setupTkey(
    providedImportKey?: string,
    sfaLoginResponse?: TorusKey | TorusLoginResponse | TorusAggregateLoginResponse,
    importingSFAKey?: boolean
  ): Promise<void> {
    if (importingSFAKey && !sfaLoginResponse) {
      throw CoreKitError.default("SFA key registration requires SFA login response");
    }
    if (!this.state.postBoxKey) {
      throw CoreKitError.userNotLoggedIn();
    }
    const existingUser = await this.isMetadataPresent(this.state.postBoxKey);
    let importKey = providedImportKey;
    if (!existingUser) {
      if (!importKey && this.useClientGeneratedTSSKey) {
        if (this.keyType === KeyType.ed25519) {
          const k = generateEd25519Seed();
          importKey = k.toString("hex");
        } else if (this.keyType === KeyType.secp256k1) {
          const k = secp256k1.genKeyPair().getPrivate();
          importKey = scalarBNToBufferSEC1(k).toString("hex");
        } else {
          throw CoreKitError.default("Unsupported key type");
        }
      }
      if (importingSFAKey && sfaLoginResponse && sfaLoginResponse.metadata.upgraded) {
        throw CoreKitError.default("SFA key registration is not allowed for already upgraded users");
      }
      await this.handleNewUser(importKey, importingSFAKey);
    } else {
      if (importKey) {
        throw CoreKitError.tssKeyImportNotAllowed();
      }
      await this.handleExistingUser();
    }
  }

  // mutation function
  private async handleNewUser(importTssKey?: string, isSfaKey?: boolean) {
    await this.atomicSync(async () => {
      // Generate or use hash factor and initialize tkey with it.
      let factorKey: BN;
      if (this.options.disableHashedFactorKey) {
        factorKey = generateFactorKey().private;
        // delete previous hashed factorKey if present
        const hashedFactorKey = getHashedPrivateKey(this.state.postBoxKey, this.options.hashedFactorNonce);
        await this.deleteMetadataShareBackup(hashedFactorKey);
      } else {
        factorKey = getHashedPrivateKey(this.state.postBoxKey, this.options.hashedFactorNonce);
      }
      const deviceTSSIndex = TssShareType.DEVICE;
      const factorPub = getPubKeyPoint(factorKey, factorKeyCurve);
      if (!importTssKey) {
        const ec = new EC(this.keyType);
        const deviceTSSShare = ec.genKeyPair().getPrivate();
        await this.tKey.initialize({ factorPub, deviceTSSShare, deviceTSSIndex });
      } else {
        await this.tKey.initialize({ skipTssInit: true });
        await this.tKey.reconstructKey();
        await this.importTssKey(importTssKey, factorPub, deviceTSSIndex);
      }

      // Finalize initialization.
      await this.tKey.reconstructKey();
      await this.finalizeTkey(factorKey);

      // Store factor description.
      await this.backupMetadataShare(factorKey);
      if (this.options.disableHashedFactorKey) {
        await this.addFactorDescription({
          factorKey,
          shareDescription: FactorKeyTypeShareDescription.Other,
          updateMetadata: false,
        });
        await this.setDeviceFactor(factorKey);
      } else {
        await this.addFactorDescription({
          factorKey,
          shareDescription: FactorKeyTypeShareDescription.HashedShare,
          updateMetadata: false,
        });
      }
      if (importTssKey && isSfaKey) {
        await this.tkey.addLocalMetadataTransitions({
          input: [{ message: ONE_KEY_DELETE_NONCE }],
          privKey: [new BN(this.state.postBoxKey, "hex")],
        });
      }
    });
  }

  private async handleExistingUser() {
    await this.tKey.initialize({ neverInitializeNewKey: true });
    if (this.options.disableHashedFactorKey) {
      return;
    }

    const hashedFactorKey = getHashedPrivateKey(this.state.postBoxKey, this.options.hashedFactorNonce);
    this.state.factorKey = hashedFactorKey;
    if (await this.checkIfFactorKeyValid(hashedFactorKey)) {
      // Initialize tkey with existing hashed share if available.
      const factorKeyMetadata: ShareStore = await this.getFactorKeyMetadata(hashedFactorKey);
      try {
        await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
        await this.tKey.reconstructKey();
        await this.finalizeTkey(hashedFactorKey);
      } catch (err) {
        log.error("error initializing tkey with hashed share", err);
      }
    } else {
      const factorKeyMetadata = await this.tKey?.readMetadata<StringifiedType>(hashedFactorKey);
      if (factorKeyMetadata.message === "SHARE_DELETED") {
        // throw CoreKitError.hashedFactorDeleted();
        log.warn("hashed factor deleted");
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
    const tssPubKey = this.tKey.getTSSPub().toSEC1(this.tkey.tssCurve, false);

    this.updateState({ tssShareIndex, tssPubKey, factorKey });

    await this.createSession();
  }

  private checkReady() {
    if (!this.ready) {
      throw CoreKitError.mpcCoreKitNotInitialized();
    }
  }

  private async rehydrateSession(result: SessionData): Promise<boolean> {
    const startTime = Date.now();
    try {
      this.checkReady();

      const factorKey = new BN(result.factorKey, "hex");
      if (!factorKey) {
        throw CoreKitError.providedFactorKeyInvalid();
      }
      const postBoxKey = result.postBoxKey || result.oAuthKey;
      if (!postBoxKey) {
        throw CoreKitError.default("postBoxKey or oAuthKey not present in session data");
      }
      this.torusSp.postboxKey = new BN(postBoxKey, "hex");
      this.torusSp.verifierName = result.userInfo.aggregateVerifier || result.userInfo.verifier;
      this.torusSp.verifierId = result.userInfo.verifierId;
      const factorKeyMetadata = await this.getFactorKeyMetadata(factorKey);
      await this.tKey.initialize({ neverInitializeNewKey: true });
      await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
      await this.tKey.reconstructKey();

      this.updateState({
        factorKey: new BN(result.factorKey, "hex"),
        postBoxKey,
        postboxKeyNodeIndexes: result.postboxKeyNodeIndexes || [],
        tssShareIndex: result.tssShareIndex,
        tssPubKey: this.tkey.getTSSPub().toSEC1(this.tKey.tssCurve, false),
        signatures: result.signatures,
        userInfo: result.userInfo,
      });

      // update device factor if not present upon rehydration
      if (this.options.disableHashedFactorKey) {
        const deviceFactorKey = await this.getDeviceFactor();
        if (!deviceFactorKey && this.state.factorKey && this.state.tssShareIndex === TssShareType.DEVICE) {
          await this.setDeviceFactor(this.state.factorKey);
        }
      }
      void this.analytics.track(ANALYTICS_EVENTS.SESSION_REHYDRATION_COMPLETED, {
        factor_share_type: this.state.tssShareIndex,
        duration: Date.now() - startTime,
      });
      return true;
    } catch (err) {
      log.warn("failed to authorize session please use new instance without rehydration", err);
      void this.analytics.track(ANALYTICS_EVENTS.SESSION_REHYDRATION_FAILED, {
        ...getErrorAnalyticsProperties(err),
        duration: Date.now() - startTime,
      });
      return false;
    }
  }

  private async createSession() {
    if (!this.options.disableSessionManager && !this.sessionManager) {
      throw new Error("sessionManager is not available");
    }
    if (this.options.disableSessionManager) {
      return;
    }

    try {
      const sessionId = SessionManager.generateRandomSessionKey();
      this.sessionManager.sessionId = sessionId;
      const { postBoxKey, factorKey, userInfo, tssShareIndex, tssPubKey, postboxKeyNodeIndexes } = this.state;
      if (!this.state.factorKey) {
        throw CoreKitError.factorKeyNotPresent("factorKey not present in state when creating session.");
      }
      const { tssShare } = await this.tKey.getTSSShare(this.state.factorKey, {
        accountIndex: this.state.accountIndex,
      });
      if (!postBoxKey || !factorKey || !tssShare || !tssPubKey || !userInfo) {
        throw CoreKitError.userNotLoggedIn();
      }
      const payload: SessionData = {
        postBoxKey,
        postboxKeyNodeIndexes: postboxKeyNodeIndexes || [],
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
      void this.analytics.track(ANALYTICS_EVENTS.SESSION_CREATION_FAILED, getErrorAnalyticsProperties(err));
    }
  }

  private async isMetadataPresent(privateKey: string) {
    const privateKeyBN = new BN(privateKey, "hex");
    const metadata = await this.tKey?.readMetadata<StringifiedType>(privateKeyBN);
    if (metadata && metadata.message !== "KEY_NOT_FOUND") {
      return true;
    }
    return false;
  }

  private async checkIfFactorKeyValid(factorKey: BN): Promise<boolean> {
    this.checkReady();
    const factorKeyMetadata = await this.tKey?.readMetadata<StringifiedType>(factorKey);
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND" || factorKeyMetadata.message === "SHARE_DELETED") {
      return false;
    }
    return true;
  }

  private async getFactorKeyMetadata(factorKey: BN): Promise<ShareStore> {
    this.checkReady();
    const factorKeyMetadata = await this.tKey?.readMetadata<StringifiedType>(factorKey);
    if (!factorKeyMetadata || factorKeyMetadata.message === KEY_NOT_FOUND || factorKeyMetadata.message === SHARE_DELETED) {
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
  private async copyOrCreateShare(newFactorTSSIndex: number, newFactorPub: Point) {
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

    // Generate new share.
    await this.tkey.addFactorPub({
      existingFactorKey: this.state.factorKey,
      authSignatures: this.signatures,
      newFactorPub,
      newTSSIndex: newFactorTSSIndex,
      refreshShares: this.state.tssShareIndex !== newFactorTSSIndex, // Refresh shares if we have a new factor key index.
    });
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
    await this.atomicSync(async () => {
      await this.tKey.addLocalMetadataTransitions({ input: [{ message: SHARE_DELETED, dateAdded: Date.now() }], privKey: [factorKey] });
    });
  }

  private async backupMetadataShare(factorKey: BN) {
    const metadataShare = await this.getMetadataShare();

    await this.atomicSync(async () => {
      // Set metadata for factor key backup
      await this.tKey?.addLocalMetadataTransitions({
        input: [metadataShare],
        privKey: [factorKey],
      });
    });
  }

  private async addFactorDescription(args: {
    factorKey: BN;
    shareDescription: FactorKeyTypeShareDescription;
    additionalMetadata?: Record<string, string>;
    updateMetadata?: boolean;
  }) {
    const { factorKey, shareDescription, updateMetadata } = args;

    let { additionalMetadata } = args;
    if (!additionalMetadata) {
      additionalMetadata = {};
    }

    const { tssIndex } = await this.tKey.getTSSShare(factorKey);
    const factorPoint = getPubKeyPoint(factorKey, factorKeyCurve);
    const factorPub = factorPoint.toSEC1(factorKeyCurve, true).toString("hex");

    const params = {
      module: shareDescription,
      dateAdded: Date.now(),
      ...additionalMetadata,
      tssShareIndex: tssIndex,
    };
    await this.tKey?.addShareDescription(factorPub, JSON.stringify(params), updateMetadata);
  }

  private getInitializationTrackData(): Record<string, unknown> {
    const storageType = typeof this.options.storage === "string" ? this.options.storage : "async" in this.options.storage ? "async_custom" : "custom";
    return {
      auth_ux_mode: this.options.uxMode,
      logging_enabled: this.enableLogging,
      storage_type: storageType,
      key_type: this.keyType,
      manual_sync: this.options.manualSync,
      hashed_factor_enabled: !this.options.disableHashedFactorKey,
      session_manager_enabled: !this.options.disableSessionManager,
      use_dkg: this.options.useDKG,
    };
  }

  private trackInitializationCompleted(startTime: number, extra: Record<string, unknown> = {}): void {
    if (this.skipInitAnalytics) return;
    void this.analytics.track(ANALYTICS_EVENTS.SDK_INITIALIZATION_COMPLETED, {
      ...this.getInitializationTrackData(),
      ...extra,
      duration: Date.now() - startTime,
    });
  }

  private getConnectionTrackData(params: OAuthLoginParams): Record<string, unknown> {
    if ("subVerifierDetails" in params) {
      return {
        login_method: "oauth",
        verifier: params.subVerifierDetails.verifier,
        auth_connection: params.subVerifierDetails.typeOfLogin,
        is_aggregate_verifier: false,
      };
    }
    return {
      login_method: "oauth",
      verifier: params.aggregateVerifierIdentifier,
      auth_connection: params.subVerifierDetailsArray[0]?.typeOfLogin,
      is_aggregate_verifier: true,
    };
  }

  private enrichRedirectConnectionTrackData(trackData: Record<string, unknown>, userInfo?: UserInfo): Record<string, unknown> {
    return {
      ...trackData,
      login_method: "redirect",
      verifier: trackData.verifier ?? userInfo?.aggregateVerifier ?? userInfo?.verifier,
      auth_connection: trackData.auth_connection ?? userInfo?.typeOfLogin,
      is_aggregate_verifier: trackData.is_aggregate_verifier ?? Boolean(userInfo?.aggregateVerifier),
    };
  }

  private getJWTTrackData(params: JWTLoginParams): Record<string, unknown> {
    return {
      login_method: "jwt",
      verifier: params.verifier,
      is_aggregate_verifier: Boolean(params.subVerifier),
      is_sfa: true,
    };
  }

  private trackConnectionOutcome(startTime: number, trackData: Record<string, unknown>): void {
    if (this.status === COREKIT_STATUS.LOGGED_IN) {
      void this.analytics.track(ANALYTICS_EVENTS.CONNECTION_COMPLETED, {
        ...trackData,
        corekit_status: this.status,
        duration: Date.now() - startTime,
      });
    } else if (this.status === COREKIT_STATUS.REQUIRED_SHARE) {
      this.trackRequiredShare(startTime, trackData);
    }
  }

  private trackRequiredShare(startTime: number, trackData: Record<string, unknown>): void {
    void this.analytics.track(ANALYTICS_EVENTS.LOGIN_REQUIRED_SHARE, {
      ...trackData,
      corekit_status: COREKIT_STATUS.REQUIRED_SHARE,
      duration: Date.now() - startTime,
    });
  }

  private resetState(): void {
    this.ready = false;
    this.tkey = null;
    this.torusSp = null;
    this.storageLayer = null;
    this.state = { accountIndex: 0 };
  }

  private _getPostBoxKey(result: TorusKey): string {
    return TorusUtils.getPostboxKey(result);
  }

  private _getSignatures(sessionData: TorusKey["sessionData"]["sessionTokenData"]): string[] {
    // There is a check in torus.js which pushes undefined to session data in case
    // that particular node call fails.
    // and before returning we are not filtering out undefined vals in torus.js
    // TODO: fix this in torus.js
    return sessionData.filter((session) => !!session).map((session) => JSON.stringify({ data: session.token, sig: session.signature }));
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
      session_time: this.options.sessionTime.toString(),
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

  private getAccountNonce() {
    return this.tkey.computeAccountNonce(this.state.accountIndex);
  }

  private async sign_ECDSA_secp256k1(data: Buffer, hashed: boolean = false, precomputedTssClient?: Secp256k1PrecomputedClient) {
    const executeSign = async (client: Client, serverCoeffs: Record<string, string>, hashedData: Buffer, signatures: string[]) => {
      const { r, s, recoveryParam } = await client.sign(hashedData.toString("base64"), true, "", "keccak256", {
        signatures,
      });
      // skip await cleanup
      client.cleanup({ signatures, server_coeffs: serverCoeffs });
      return { v: recoveryParam, r: scalarBNToBufferSEC1(r), s: scalarBNToBufferSEC1(s) };
    };
    if (!hashed) {
      data = keccak256(data);
    }

    const isAlreadyPrecomputed = precomputedTssClient?.client && precomputedTssClient?.serverCoeffs;
    const { client, serverCoeffs } = isAlreadyPrecomputed ? precomputedTssClient : await this.precompute_secp256k1();

    const { signatures } = this;
    if (!signatures) {
      throw CoreKitError.signaturesNotPresent();
    }

    try {
      return await executeSign(client, serverCoeffs, data, signatures);
    } catch (error) {
      if (!isAlreadyPrecomputed) {
        throw error;
      }
      // Retry with new client if precomputed client failed, this is to handle the case when precomputed session might have expired
      const { client: newClient, serverCoeffs: newServerCoeffs } = await this.precompute_secp256k1();
      const result = await executeSign(newClient, newServerCoeffs, data, signatures);

      return result;
    }
  }

  private async sign_ed25519(data: Buffer, hashed: boolean = false): Promise<Buffer> {
    if (hashed) {
      throw CoreKitError.default("hashed data not supported for ed25519");
    }

    const nodeDetails = fetchLocalConfig(this.options.web3AuthNetwork, "ed25519");
    if (!nodeDetails.torusNodeTSSEndpoints) {
      throw CoreKitError.default("could not fetch tss node endpoints");
    }

    // Endpoints must end with backslash, but URLs returned by
    // `fetch-node-details` don't have it.
    const ED25519_ENDPOINTS = nodeDetails.torusNodeTSSEndpoints.map((ep, i) => ({ index: nodeDetails.torusIndexes[i], url: `${ep}/` }));

    // Select endpoints and derive party indices.
    const serverThreshold = Math.floor(ED25519_ENDPOINTS.length / 2) + 1;
    const endpoints = sampleEndpoints(ED25519_ENDPOINTS, serverThreshold);
    const serverXCoords = endpoints.map((x) => x.index);
    const clientXCoord = Math.max(...endpoints.map((ep) => ep.index)) + 1;

    // Derive share coefficients for flat hierarchy.
    const ec = new Ed25519Curve();
    const { serverCoefficients, clientCoefficient } = deriveShareCoefficients(ec, serverXCoords, clientXCoord, this.state.tssShareIndex);

    // Get pub key.
    const tssPubKey = await this.getPubKey();
    const tssPubKeyPoint = ec.keyFromPublic(tssPubKey).getPublic();

    // Get client key share and adjust by coefficient.
    if (this.state.accountIndex !== 0) {
      throw CoreKitError.default("Account index not supported for ed25519");
    }
    const { tssShare } = await this.tKey.getTSSShare(this.state.factorKey);
    const clientShareAdjusted = tssShare.mul(clientCoefficient).umod(ec.n);
    const clientShareAdjustedHex = ec.scalarToBuffer(clientShareAdjusted, Buffer).toString("hex");

    // Generate session identifier.
    const tssNonce = this.getTssNonce();
    const sessionNonce = generateSessionNonce();
    const session = getSessionId(this.verifier, this.verifierId, this.tKey.tssTag, tssNonce, sessionNonce);

    // Run signing protocol.
    const serverURLs = endpoints.map((x) => x.url);
    const pubKeyHex = ec.pointToBuffer(tssPubKeyPoint, Buffer).toString("hex");
    const serverCoefficientsHex = serverCoefficients.map((c) => ec.scalarToBuffer(c, Buffer).toString("hex"));
    const signature = await signEd25519(
      this.wasmLib as FrostWasmLib,
      session,
      this.signatures,
      serverXCoords,
      serverURLs,
      clientXCoord,
      clientShareAdjustedHex,
      pubKeyHex,
      data,
      serverCoefficientsHex,
      this.socketTransports
    );

    log.info(`signature: ${signature}`);
    return Buffer.from(signature, "hex");
  }

  private async loadTssWasm() {
    if (this.wasmLib) return this.wasmLib;
    if (typeof (this._tssLib as V4TSSLibType).load === "function") {
      // dont wait for wasm to be loaded, we can reload it during signing if not loaded
      return (this._tssLib as V4TSSLibType).load();
    } else if ((this._tssLib as V3TSSLibType).lib) {
      return (this._tssLib as V3TSSLibType).lib as DKLSWasmLib | FrostWasmLib;
    }
  }
}
