import { BNString, KeyType, Point, secp256k1, SHARE_DELETED, ShareStore, StringifiedType } from "@tkey/common-types";
import { CoreError } from "@tkey/core";
import { ShareSerializationModule } from "@tkey/share-serialization";
import { TorusStorageLayer } from "@tkey/storage-layer-torus";
import { factorKeyCurve, getPubKeyPoint, lagrangeInterpolation, TKeyTSS, TSSTorusServiceProvider } from "@tkey/tss";
import { SIGNER_MAP } from "@toruslabs/constants";
import { AGGREGATE_VERIFIER, TORUS_METHOD, TorusAggregateLoginResponse, TorusLoginResponse, UX_MODE } from "@toruslabs/customauth";
import type { UX_MODE_TYPE } from "@toruslabs/customauth/dist/types/utils/enums";
import { Ed25519Curve } from "@toruslabs/elliptic-wrapper";
import { NodeDetailManager } from "@toruslabs/fetch-node-details";
import { fetchLocalConfig } from "@toruslabs/fnd-base";
import { keccak256 } from "@toruslabs/metadata-helpers";
import { OpenloginSessionManager } from "@toruslabs/openlogin-session-manager";
import TorusUtils, { TorusKey } from "@toruslabs/torus.js";
import { Client, getDKLSCoeff, setupSockets } from "@toruslabs/tss-client";
import { sign as signEd25519 } from "@toruslabs/tss-frost-client";
import { CHAIN_NAMESPACES, log } from "@web3auth/base";
import BN from "bn.js";
import bowser from "bowser";
import { ec as EC } from "elliptic";

import {
  DEFAULT_CHAIN_CONFIG,
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
  IdTokenLoginParams,
  IFactorKey,
  InitParams,
  MPCKeyDetails,
  OauthLoginParams,
  SessionData,
  SubVerifierDetailsParams,
  TkeyLocalStoreData,
  TssLib,
  UserInfo,
  Web3AuthOptions,
  Web3AuthOptionsWithDefaults,
  Web3AuthState,
} from "./interfaces";
import {
  deriveShareCoefficients,
  ed25519,
  generateFactorKey,
  generateSessionNonce,
  generateTSSEndpoints,
  getHashedPrivateKey,
  getSessionId,
  parseToken,
  sampleEndpoints,
  scalarBNToBufferSEC1,
} from "./utils";

TorusUtils.enableLogging(false); // TODO remove this line

export class Web3AuthMPCCoreKit implements ICoreKit {
  public state: Web3AuthState = { accountIndex: 0 };

  private options: Web3AuthOptionsWithDefaults;

  private torusSp: TSSTorusServiceProvider | null = null;

  private storageLayer: TorusStorageLayer | null = null;

  private tkey: TKeyTSS | null = null;

  private sessionManager!: OpenloginSessionManager<SessionData>;

  private currentStorage: AsyncStorage;

  private nodeDetailManager!: NodeDetailManager;

  private _storageBaseKey = "corekit_store";

  private enableLogging = false;

  private ready = false;

  private _tssLib: TssLib;

  private _keyType: KeyType;

  constructor(options: Web3AuthOptions) {
    if (!options.chainConfig) options.chainConfig = DEFAULT_CHAIN_CONFIG;
    if (options.chainConfig.chainNamespace !== CHAIN_NAMESPACES.EIP155) {
      throw CoreKitError.chainConfigInvalid();
    }
    if (!options.web3AuthClientId) {
      throw CoreKitError.clientIdInvalid();
    }

    this._tssLib = options.tssLib;
    this._keyType = options.tssLib.keyType as KeyType;

    const isNodejsOrRN = this.isNodejsOrRN(options.uxMode);

    // if (await storageAvailable(options.storage)) {
    //   throw CoreKitError.storageTypeUnsupported(`Unsupported storage type ${options.storageKey} for ${options.uxMode} mode.`);
    // }

    if (options.enableLogging) {
      log.enableAll();
      this.enableLogging = true;
    } else log.setLevel("error");
    if (typeof options.manualSync !== "boolean") options.manualSync = false;
    if (!options.web3AuthNetwork) options.web3AuthNetwork = WEB3AUTH_NETWORK.MAINNET;
    if (!options.sessionTime) options.sessionTime = 86400;
    if (!options.serverTimeOffset) options.serverTimeOffset = 0;
    if (!options.uxMode) options.uxMode = UX_MODE.REDIRECT;
    if (!options.redirectPathName) options.redirectPathName = "redirect";
    if (!options.baseUrl) options.baseUrl = isNodejsOrRN ? "https://localhost" : `${window?.location.origin}/serviceworker`;
    if (!options.disableHashedFactorKey) options.disableHashedFactorKey = false;
    if (!options.hashedFactorNonce) options.hashedFactorNonce = options.web3AuthClientId;

    this.options = options as Web3AuthOptionsWithDefaults;

    this.currentStorage = new AsyncStorage(this._storageBaseKey, options.storage);

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

  get metadataKey(): string | null {
    // this return oauthkey which is used by demo to reset account.
    // this is not the same metadataKey from tkey.
    // to be fixed in next major release
    return this.state?.oAuthKey ? this.state.oAuthKey : null;
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
      if (!tkey.privKey || !this.state.factorKey) return COREKIT_STATUS.REQUIRED_SHARE;
      return COREKIT_STATUS.LOGGED_IN;
    } catch (e) {}
    return COREKIT_STATUS.NOT_INITIALIZED;
  }

  get sessionId(): string {
    return this.sessionManager.sessionId;
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

    const finalKey = lagrangeInterpolation(this.tkey.tssCurve, tssShares, tssIndexesBN);
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
      await this.handleRedirectResult();

      // if not redirect flow try to rehydrate session if available
    } else if (params.rehydrate && this.sessionManager.sessionId) {
      // swallowed, should not throw on rehydrate timed out session
      const sessionResult = await this.sessionManager.authorizeSession().catch(async (err) => {
        log.error("rehydrate session error", err);
      });

      // try rehydrate session
      if (sessionResult) {
        await this.rehydrateSession(sessionResult);
      } else {
        // feature gating on no session rehydration
        await this.featureRequest();
        TorusUtils.setSessionTime(this.options.sessionTime);
      }
    } else {
      // feature gating if not redirect flow or session rehydration
      await this.featureRequest();
      TorusUtils.setSessionTime(this.options.sessionTime);
    }

    // if not redirect flow or session rehydration, ask for factor key to login
  }

  public async loginWithOauth(params: OauthLoginParams): Promise<void> {
    this.checkReady();
    if (this.isNodejsOrRN(this.options.uxMode)) {
      throw CoreKitError.oauthLoginUnsupported(`Oauth login is NOT supported in ${this.options.uxMode} mode.`);
    }
    const { importTssKey } = params;
    const tkeyServiceProvider = this.torusSp;

    try {
      // oAuth login.
      const verifierParams = params as SubVerifierDetailsParams;
      const aggregateParams = params as AggregateVerifierLoginParams;
      if (verifierParams.subVerifierDetails) {
        // single verifier login.
        const loginResponse = await tkeyServiceProvider.triggerLogin((params as SubVerifierDetailsParams).subVerifierDetails);

        if (this.isRedirectMode) return;

        this.updateState({
          oAuthKey: this._getPostBoxKey(loginResponse),
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
          oAuthKey: this._getPostBoxKey(loginResponse),
          userInfo: loginResponse.userInfo[0],
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
        });
      }

      await this.setupTkey(importTssKey);
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

    this.torusSp.verifierName = verifier;
    this.torusSp.verifierId = verifierId;

    try {
      // prefetch tss pub key
      const prefetchTssPubs = [];
      for (let i = 0; i < opt.prefetchTssPublicKeys; i++) {
        prefetchTssPubs.push(this.torusSp.getTSSPubKey("default", i));
      }
      // oAuth login.
      let loginResponse: TorusKey;
      if (!idTokenLoginParams.subVerifier) {
        // single verifier login.
        loginResponse = await this.torusSp.customAuthInstance.getTorusKey(verifier, verifierId, { verifier_id: verifierId }, idToken, {
          ...idTokenLoginParams.extraVerifierParams,
          ...idTokenLoginParams.additionalParams,
        });
        // this.torusSp.verifierType = "normal";
      } else {
        // aggregate verifier login
        loginResponse = await this.torusSp.customAuthInstance.getAggregateTorusKey(verifier, verifierId, [
          { verifier: idTokenLoginParams.subVerifier, idToken, extraVerifierParams: idTokenLoginParams.extraVerifierParams },
        ]);
        // this.torusSp.verifierType = "aggregate";
      }

      const postBoxKey = this._getPostBoxKey(loginResponse);

      this.torusSp.postboxKey = new BN(postBoxKey, "hex");

      this.updateState({
        oAuthKey: postBoxKey,
        userInfo: { ...parseToken(idToken), verifier, verifierId },
        signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData),
      });

      // wait for prefetch completed before setup tkey
      await Promise.all(prefetchTssPubs);

      await this.setupTkey(importTssKey);
    } catch (err: unknown) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) {
          const newError = CoreKitError.default(ERRORS.TKEY_SHARES_REQUIRED);
          newError.stack = err.stack;
          throw newError;
        }
      }
      const newError = CoreKitError.default((err as Error).message);
      newError.stack = (err as Error).stack;
      throw newError;
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
        this.updateState({
          oAuthKey: this._getPostBoxKey(data),
          userInfo: data.userInfo,
          signatures: this._getSignatures(data.sessionData.sessionTokenData),
        });
        // this.torusSp.verifierType = "normal";
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.verifier;
      } else if (result.method === TORUS_METHOD.TRIGGER_AGGREGATE_LOGIN) {
        const data = result.result as TorusAggregateLoginResponse;
        if (!data) {
          throw CoreKitError.invalidTorusAggregateLoginResponse();
        }
        this.updateState({
          oAuthKey: this._getPostBoxKey(data),
          userInfo: data.userInfo[0],
          signatures: this._getSignatures(data.sessionData.sessionTokenData),
        });
        // this.torusSp.verifierType = "aggregate";
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

  public async enableMFA(enableMFAParams: EnableMFAParams, recoveryFactor = true): Promise<string> {
    this.checkReady();

    const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.hashedFactorNonce);
    if (!(await this.checkIfFactorKeyValid(hashedFactorKey))) {
      if (this.tKey._localMetadataTransitions[0].length) {
        throw CoreKitError.commitChangesBeforeMFA();
      }
      throw CoreKitError.mfaAlreadyEnabled();
    }

    return this.atomicSync(async () => {
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
      await this.setDeviceFactor(deviceFactorKey);
      await this.inputFactorKey(new BN(deviceFactorKey, "hex"));

      const hashedFactorPub = getPubKeyPoint(hashedFactorKey, factorKeyCurve);
      await this.deleteFactor(hashedFactorPub, hashedFactorKey);
      await this.deleteMetadataShareBackup(hashedFactorKey);

      // only recovery factor = true
      let backupFactorKey;
      if (recoveryFactor) {
        backupFactorKey = await this.createFactor({ shareType: TssShareType.RECOVERY, ...enableMFAParams });
      }

      // update to undefined for next major release
      return backupFactorKey;
    }).catch((reason: Error) => {
      log.error("error enabling MFA:", reason.message);
      const err = CoreKitError.default(reason.message);
      err.stack = reason.stack;
      throw err;
    });
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

    const factorPub = getPubKeyPoint(factorKey, factorKeyCurve);

    if (this.getTssFactorPub().includes(factorPub.toSEC1(factorKeyCurve, true).toString("hex"))) {
      throw CoreKitError.factorKeyAlreadyExists();
    }

    return this.atomicSync(async () => {
      await this.copyOrCreateShare(shareType, factorPub);
      await this.backupMetadataShare(factorKey);
      await this.addFactorDescription(factorKey, shareDescription, additionalMetadata);

      return scalarBNToBufferSEC1(factorKey).toString("hex");
    }).catch((reason: Error) => {
      log.error("error creating factor:", reason.message);
      const err = CoreKitError.default(`error creating factor: ${reason.message}`);
      err.stack = reason.stack;
      throw err;
    });
  }

  /**
   * Get public key point in SEC1 format.
   */
  public getPubKey(): Buffer {
    const { tssPubKey } = this.state;
    return Buffer.from(tssPubKey);
  }

  /**
   * Get public key point.
   */
  public getPubKeyPoint(): Point {
    const { tssPubKey } = this.state;
    return Point.fromSEC1(this.tkey.tssCurve, tssPubKey.toString("hex"));
  }

  /**
   * Get public key in ed25519 format.
   *
   * Throws an error if keytype is not compatible with ed25519.
   */
  public getPubKeyEd25519(): Buffer {
    const p = this.tkey.tssCurve.keyFromPublic(this.getPubKey()).getPublic();
    return ed25519.keyFromPublic(p).getPublic();
  }

  public async sign(data: Buffer, hashed: boolean = false): Promise<Buffer> {
    if (this.keyType === KeyType.secp256k1) {
      const sig = await this.sign_ECDSA_secp256k1(data, hashed);
      return Buffer.concat([sig.r, sig.s, Buffer.from([sig.v])]);
    } else if (this.keyType === KeyType.ed25519) {
      return this.sign_ed25519(data, hashed);
    }
    throw new Error(`sign not supported for key type ${this.keyType}`);
  }

  // mutation function
  async deleteFactor(factorPub: Point, factorKey?: BNString): Promise<void> {
    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when deleting a factor.");
    }
    if (!this.tKey.metadata.factorPubs) {
      throw CoreKitError.factorPubsMissing();
    }

    await this.atomicSync(async () => {
      const remainingFactors = this.tKey.metadata.factorPubs[this.tKey.tssTag].length || 0;
      if (remainingFactors <= 1) throw new Error("Cannot delete last factor");
      const fpp = factorPub;
      const stateFpp = getPubKeyPoint(this.state.factorKey, factorKeyCurve);
      if (fpp.equals(stateFpp)) {
        throw new Error("Cannot delete current active factor");
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
  }

  public async logout(): Promise<void> {
    if (this.sessionManager.sessionId) {
      await this.sessionManager.invalidateSession();
    }
    // to accommodate async storage
    await this.currentStorage.set("sessionId", "");

    this.resetState();
    await this.init({ handleRedirectResult: false, rehydrate: false });
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
      if (existingFactor) throw new Error("Device factor already exists");
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
    });

    return exportTssKey.toString("hex", FIELD_ELEMENT_HEX_LEN);
  }

  protected async atomicSync<T>(f: () => Promise<T>): Promise<T> {
    this.tkey.manualSync = true;
    try {
      const r = await f();
      await this.commitChanges();
      return r;
    } finally {
      this.tkey.manualSync = this.options.manualSync;
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

  private async setupTkey(importTssKey?: string): Promise<void> {
    if (!this.state.oAuthKey) {
      throw CoreKitError.userNotLoggedIn();
    }
    const existingUser = await this.isMetadataPresent(this.state.oAuthKey);
    if (!existingUser) {
      await this.handleNewUser(importTssKey);
    } else {
      if (importTssKey) {
        throw CoreKitError.tssKeyImportNotAllowed();
      }
      await this.handleExistingUser();
    }
  }

  // mutation function
  private async handleNewUser(importTssKey?: string) {
    await this.atomicSync(async () => {
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
        await this.addFactorDescription(factorKey, FactorKeyTypeShareDescription.Other);
      } else {
        await this.addFactorDescription(factorKey, FactorKeyTypeShareDescription.HashedShare);
      }
    });
  }

  private async handleExistingUser() {
    await this.tKey.initialize({ neverInitializeNewKey: true });
    if (this.options.disableHashedFactorKey) {
      return;
    }

    const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.hashedFactorNonce);
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
      // this.torusSp.verifierType = result.userInfo.aggregateVerifier ? "aggregate" : "normal";
      const factorKeyMetadata = await this.getFactorKeyMetadata(factorKey);
      await this.tKey.initialize({ neverInitializeNewKey: true });
      await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
      await this.tKey.reconstructKey();

      this.updateState({
        factorKey: new BN(result.factorKey, "hex"),
        oAuthKey: result.oAuthKey,
        tssShareIndex: result.tssShareIndex,
        tssPubKey: this.tkey.getTSSPub().toSEC1(this.tKey.tssCurve, false),
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
    const metadata = await this.tKey?.readMetadata<StringifiedType>(privateKeyBN);
    if (metadata && Object.keys(metadata).length > 0 && metadata.message !== "KEY_NOT_FOUND") {
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
    if (!this.state.factorKey) {
      throw new Error("factorKey not present");
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
    const tkeyPoint = getPubKeyPoint(factorKey, factorKeyCurve);
    const factorPub = tkeyPoint.toSEC1(this.tkey.tssCurve, true).toString("hex");
    const params = {
      module: shareDescription,
      dateAdded: Date.now(),
      ...additionalMetadata,
      tssShareIndex: tssIndex,
    };
    await this.tKey?.addShareDescription(factorPub, JSON.stringify(params), updateMetadata);
  }

  private updateState(newState: Partial<Web3AuthState>): void {
    this.state = { ...this.state, ...newState };
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
    return sessionData.map((session) => JSON.stringify({ data: session.token, sig: session.signature }));
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

  private async sign_ECDSA_secp256k1(data: Buffer, hashed: boolean = false) {
    if (!hashed) {
      data = keccak256(data);
    }

    // PreSetup
    const { tssShareIndex } = this.state;
    let tssPubKey = await this.getPubKey();

    const { torusNodeTSSEndpoints } = await this.nodeDetailManager.getNodeDetails({
      verifier: this.tkey.serviceProvider.verifierName,
      verifierId: this.tkey.serviceProvider.verifierId,
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
    const sockets = await setupSockets(tssWSEndpoints, randomSessionNonce);

    const dklsCoeff = getDKLSCoeff(true, participatingServerDKGIndexes, tssShareIndex as number);
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

    const client = new Client(
      currentSession,
      clientIndex,
      partyIndexes,
      endpoints,
      sockets,
      share,
      tssPubKey.toString("base64"),
      true,
      this._tssLib.lib
    );
    client.log = (_msg) => {}; // TODO remove this line
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

    const { r, s, recoveryParam } = await client.sign(data.toString("base64"), true, "", "keccak256", {
      signatures,
    });

    // skip await cleanup
    client.cleanup({ signatures, server_coeffs: serverCoeffs });
    return { v: recoveryParam, r: scalarBNToBufferSEC1(r), s: scalarBNToBufferSEC1(s) };
  }

  private async sign_ed25519(data: Buffer, hashed: boolean = false): Promise<Buffer> {
    if (hashed) {
      throw new Error("hashed data not supported for ed25519");
    }

    const nodeDetails = fetchLocalConfig(this.options.web3AuthNetwork, "ed25519");
    if (!nodeDetails.torusNodeTSSEndpoints) {
      throw new Error("could not fetch tss node endpoints");
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
    const { serverCoefficients, clientCoefficient } = deriveShareCoefficients(ec, serverXCoords, clientXCoord);

    // Get pub key.
    const tssPubKey = await this.getPubKey();
    const tssPubKeyPoint = ec.keyFromPublic(tssPubKey).getPublic();

    // Get client key share and adjust by coefficient.
    if (this.state.accountIndex !== 0) {
      throw new Error("Account index not supported for ed25519");
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
      this._tssLib.lib,
      session,
      this.signatures,
      serverXCoords,
      serverURLs,
      clientXCoord,
      clientShareAdjustedHex,
      pubKeyHex,
      data,
      serverCoefficientsHex
    );

    log.info(`signature: ${signature}`);
    return Buffer.from(signature, "hex");
  }
}
