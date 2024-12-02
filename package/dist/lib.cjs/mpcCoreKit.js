'use strict';

var _objectSpread = require('@babel/runtime/helpers/objectSpread2');
var _defineProperty = require('@babel/runtime/helpers/defineProperty');
var commonTypes = require('@tkey/common-types');
var core = require('@tkey/core');
var shareSerialization = require('@tkey/share-serialization');
var storageLayerTorus = require('@tkey/storage-layer-torus');
var tss = require('@tkey/tss');
var constants$1 = require('@toruslabs/constants');
var customauth = require('@toruslabs/customauth');
var ellipticWrapper = require('@toruslabs/elliptic-wrapper');
var fndBase = require('@toruslabs/fnd-base');
var metadataHelpers = require('@toruslabs/metadata-helpers');
var sessionManager = require('@toruslabs/session-manager');
var torus_js = require('@toruslabs/torus.js');
var tssClient = require('@toruslabs/tss-client');
var tssFrostClient = require('@toruslabs/tss-frost-client');
var BN = require('bn.js');
var bowser = require('bowser');
var elliptic = require('elliptic');
var constants = require('./constants.js');
var browserStorage = require('./helper/browserStorage.js');
var errors = require('./helper/errors.js');
var interfaces = require('./interfaces.js');
var utils = require('./utils.js');

class Web3AuthMPCCoreKit {
  constructor(options) {
    var _window;
    _defineProperty(this, "state", {
      accountIndex: 0
    });
    _defineProperty(this, "torusSp", null);
    _defineProperty(this, "options", void 0);
    _defineProperty(this, "storageLayer", null);
    _defineProperty(this, "tkey", null);
    _defineProperty(this, "sessionManager", void 0);
    _defineProperty(this, "currentStorage", void 0);
    _defineProperty(this, "_storageBaseKey", "corekit_store");
    _defineProperty(this, "enableLogging", false);
    _defineProperty(this, "ready", false);
    _defineProperty(this, "_tssLib", void 0);
    _defineProperty(this, "wasmLib", void 0);
    _defineProperty(this, "_keyType", void 0);
    _defineProperty(this, "atomicCallStackCounter", 0);
    _defineProperty(this, "getTssFactorPub", () => {
      this.checkReady();
      if (!this.state.factorKey) {
        throw errors.default.factorKeyNotPresent("factorKey not present in state when getting tss factor public key.");
      }
      const factorPubsList = this.tKey.metadata.factorPubs[this.tKey.tssTag];
      return factorPubsList.map(factorPub => factorPub.toSEC1(tss.factorKeyCurve, true).toString("hex"));
    });
    if (!options.web3AuthClientId) {
      throw errors.default.clientIdInvalid();
    }
    this._tssLib = options.tssLib;
    this._keyType = options.tssLib.keyType;
    const isNodejsOrRN = this.isNodejsOrRN(options.uxMode);
    if (options.enableLogging) {
      utils.log.enableAll();
      this.enableLogging = true;
    } else utils.log.setLevel("error");
    if (typeof options.manualSync !== "boolean") options.manualSync = false;
    if (!options.web3AuthNetwork) options.web3AuthNetwork = constants.WEB3AUTH_NETWORK.MAINNET;
    // if sessionTime is not provided, it is defaulted to 86400
    if (!options.sessionTime) options.sessionTime = 86400;
    if (!options.serverTimeOffset) options.serverTimeOffset = 0;
    if (!options.uxMode) options.uxMode = customauth.UX_MODE.REDIRECT;
    if (!options.redirectPathName) options.redirectPathName = "redirect";
    if (!options.baseUrl) options.baseUrl = isNodejsOrRN ? "https://localhost" : `${(_window = window) === null || _window === void 0 ? void 0 : _window.location.origin}/serviceworker`;
    if (!options.disableHashedFactorKey) options.disableHashedFactorKey = false;
    if (!options.hashedFactorNonce) options.hashedFactorNonce = options.web3AuthClientId;
    if (options.disableSessionManager === undefined) options.disableSessionManager = false;
    this.options = options;
    this.currentStorage = new browserStorage.AsyncStorage(this._storageBaseKey, options.storage);
    if (!options.disableSessionManager) {
      this.sessionManager = new sessionManager.SessionManager({
        sessionTime: options.sessionTime
      });
    }
    torus_js.Torus.setSessionTime(this.options.sessionTime);
  }
  get tKey() {
    if (this.tkey === null) {
      throw errors.default.tkeyInstanceUninitialized();
    }
    return this.tkey;
  }
  get keyType() {
    return this._keyType;
  }
  get signatures() {
    var _this$state;
    return (_this$state = this.state) !== null && _this$state !== void 0 && _this$state.signatures ? this.state.signatures : [];
  }
  get _storageKey() {
    return this._storageBaseKey;
  }
  get status() {
    try {
      // metadata will be present if tkey is initialized (1 share)
      // if 2 shares are present, then privKey will be present after metadatakey(tkey) reconstruction
      const {
        tkey
      } = this;
      if (!tkey) return interfaces.COREKIT_STATUS.NOT_INITIALIZED;
      if (!tkey.metadata) return interfaces.COREKIT_STATUS.INITIALIZED;
      if (!tkey.secp256k1Key || !this.state.factorKey) return interfaces.COREKIT_STATUS.REQUIRED_SHARE;
      return interfaces.COREKIT_STATUS.LOGGED_IN;
    } catch (e) {}
    return interfaces.COREKIT_STATUS.NOT_INITIALIZED;
  }
  get sessionId() {
    var _this$sessionManager;
    return (_this$sessionManager = this.sessionManager) === null || _this$sessionManager === void 0 ? void 0 : _this$sessionManager.sessionId;
  }
  get supportsAccountIndex() {
    return this._keyType !== commonTypes.KeyType.ed25519;
  }
  get verifier() {
    var _this$state$userInfo, _this$state2;
    if ((_this$state$userInfo = this.state.userInfo) !== null && _this$state$userInfo !== void 0 && _this$state$userInfo.aggregateVerifier) {
      return this.state.userInfo.aggregateVerifier;
    }
    return (_this$state2 = this.state) !== null && _this$state2 !== void 0 && (_this$state2 = _this$state2.userInfo) !== null && _this$state2 !== void 0 && _this$state2.verifier ? this.state.userInfo.verifier : "";
  }
  get verifierId() {
    var _this$state3;
    return (_this$state3 = this.state) !== null && _this$state3 !== void 0 && (_this$state3 = _this$state3.userInfo) !== null && _this$state3 !== void 0 && _this$state3.verifierId ? this.state.userInfo.verifierId : "";
  }
  get isRedirectMode() {
    return this.options.uxMode === customauth.UX_MODE.REDIRECT;
  }
  get useClientGeneratedTSSKey() {
    return this.keyType === commonTypes.KeyType.ed25519 && this.options.useClientGeneratedTSSKey === undefined ? true : !!this.options.useClientGeneratedTSSKey;
  }

  // RecoverTssKey only valid for user that enable MFA where user has 2 type shares :
  // TssShareType.DEVICE and TssShareType.RECOVERY
  // if the factors key provided is the same type recovery will not works
  async _UNSAFE_recoverTssKey(factorKey) {
    this.checkReady();
    const factorKeyBN = new BN(factorKey[0], "hex");
    const shareStore0 = await this.getFactorKeyMetadata(factorKeyBN);
    await this.tKey.initialize({
      withShare: shareStore0
    });
    const tssShares = [];
    const tssIndexes = [];
    const tssIndexesBN = [];
    for (let i = 0; i < factorKey.length; i++) {
      const factorKeyBNInput = new BN(factorKey[i], "hex");
      const {
        tssIndex,
        tssShare
      } = await this.tKey.getTSSShare(factorKeyBNInput);
      if (tssIndexes.includes(tssIndex)) {
        // reset instance before throw error
        await this.init();
        throw errors.default.duplicateTssIndex();
      }
      tssIndexes.push(tssIndex);
      tssIndexesBN.push(new BN(tssIndex));
      tssShares.push(tssShare);
    }
    const finalKey = tss.lagrangeInterpolation(this.tkey.tssCurve, tssShares, tssIndexesBN);
    // reset instance after recovery completed
    await this.init();
    return finalKey.toString("hex", 64);
  }
  async init(params = {
    handleRedirectResult: true
  }) {
    var _window2, _window3;
    this.resetState();
    if (params.rehydrate === undefined) params.rehydrate = true;
    const nodeDetails = fndBase.fetchLocalConfig(this.options.web3AuthNetwork, this.keyType);
    if (this.keyType === constants$1.KEY_TYPE.ED25519 && this.options.useDKG) {
      throw errors.default.invalidConfig("DKG is not supported for ed25519 key type");
    }
    this.torusSp = new tss.TSSTorusServiceProvider({
      customAuthArgs: {
        web3AuthClientId: this.options.web3AuthClientId,
        baseUrl: this.options.baseUrl,
        uxMode: this.isNodejsOrRN(this.options.uxMode) ? customauth.UX_MODE.REDIRECT : this.options.uxMode,
        network: this.options.web3AuthNetwork,
        redirectPathName: this.options.redirectPathName,
        locationReplaceOnRedirect: true,
        serverTimeOffset: this.options.serverTimeOffset,
        keyType: this.keyType,
        useDkg: this.options.useDKG
      }
    });
    this.storageLayer = new storageLayerTorus.TorusStorageLayer({
      hostUrl: `${new URL(nodeDetails.torusNodeEndpoints[0]).origin}/metadata`,
      enableLogging: this.enableLogging
    });
    const shareSerializationModule = new shareSerialization.ShareSerializationModule();
    this.tkey = new tss.TKeyTSS({
      enableLogging: this.enableLogging,
      serviceProvider: this.torusSp,
      storageLayer: this.storageLayer,
      manualSync: this.options.manualSync,
      modules: {
        shareSerialization: shareSerializationModule
      },
      tssKeyType: this.keyType
    });
    if (this.isRedirectMode) {
      await this.torusSp.init({
        skipSw: true,
        skipPrefetch: true
      });
    } else if (this.options.uxMode === customauth.UX_MODE.POPUP) {
      await this.torusSp.init({});
    }
    this.ready = true;

    // try handle redirect flow if enabled and return(redirect) from oauth login
    if (params.handleRedirectResult && this.options.uxMode === customauth.UX_MODE.REDIRECT && ((_window2 = window) !== null && _window2 !== void 0 && _window2.location.hash.includes("#state") || (_window3 = window) !== null && _window3 !== void 0 && _window3.location.hash.includes("#access_token"))) {
      // on failed redirect, instance is reseted.
      // skip check feature gating on redirection as it was check before login
      await this.handleRedirectResult();

      // return early on successful redirect, the rest of the code will not be executed
      return;
    } else if (params.rehydrate && this.sessionManager) {
      // if not redirect flow try to rehydrate session if available
      const sessionId = await this.currentStorage.get("sessionId");
      if (sessionId) {
        this.sessionManager.sessionId = sessionId;

        // swallowed, should not throw on rehydrate timed out session
        const sessionResult = await this.sessionManager.authorizeSession().catch(async err => {
          utils.log.error("rehydrate session error", err);
        });

        // try rehydrate session
        if (sessionResult) {
          await this.rehydrateSession(sessionResult);

          // return early on success rehydration
          return;
        }
      }
    }
    // feature gating if not redirect flow or session rehydration
    await this.featureRequest();
  }
  async loginWithOAuth(params) {
    this.checkReady();
    if (this.isNodejsOrRN(this.options.uxMode)) {
      throw errors.default.oauthLoginUnsupported(`Oauth login is NOT supported in ${this.options.uxMode} mode.`);
    }
    const {
      importTssKey
    } = params;
    const tkeyServiceProvider = this.torusSp;
    try {
      // oAuth login.
      const verifierParams = params;
      const aggregateParams = params;
      if (verifierParams.subVerifierDetails) {
        var _loginResponse$nodesD;
        // single verifier login.
        const loginResponse = await tkeyServiceProvider.triggerLogin(params.subVerifierDetails);
        if (this.isRedirectMode) return;
        this.updateState({
          postBoxKey: this._getPostBoxKey(loginResponse),
          postboxKeyNodeIndexes: (_loginResponse$nodesD = loginResponse.nodesData) === null || _loginResponse$nodesD === void 0 ? void 0 : _loginResponse$nodesD.nodeIndexes,
          userInfo: loginResponse.userInfo,
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData)
        });
      } else if (aggregateParams.subVerifierDetailsArray) {
        var _loginResponse$nodesD2;
        const loginResponse = await tkeyServiceProvider.triggerAggregateLogin({
          aggregateVerifierType: aggregateParams.aggregateVerifierType || customauth.AGGREGATE_VERIFIER.SINGLE_VERIFIER_ID,
          verifierIdentifier: aggregateParams.aggregateVerifierIdentifier,
          subVerifierDetailsArray: aggregateParams.subVerifierDetailsArray
        });
        if (this.isRedirectMode) return;
        this.updateState({
          postBoxKey: this._getPostBoxKey(loginResponse),
          postboxKeyNodeIndexes: (_loginResponse$nodesD2 = loginResponse.nodesData) === null || _loginResponse$nodesD2 === void 0 ? void 0 : _loginResponse$nodesD2.nodeIndexes,
          userInfo: loginResponse.userInfo[0],
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData)
        });
      }
      await this.setupTkey(importTssKey);
    } catch (err) {
      utils.log.error("login error", err);
      if (err instanceof core.CoreError) {
        if (err.code === 1302) {
          throw errors.default.default(constants.ERRORS.TKEY_SHARES_REQUIRED);
        }
      }
      throw errors.default.default(err.message);
    }
  }
  async loginWithJWT(params) {
    this.checkReady();
    const {
      prefetchTssPublicKeys = 1
    } = params;
    if (prefetchTssPublicKeys > 3) {
      throw errors.default.prefetchValueExceeded(`The prefetch value '${prefetchTssPublicKeys}' exceeds the maximum allowed limit of 3.`);
    }
    const {
      verifier,
      verifierId,
      idToken,
      importTssKey
    } = params;
    this.torusSp.verifierName = verifier;
    this.torusSp.verifierId = verifierId;
    try {
      var _loginResponse$nodesD3;
      // prefetch tss pub keys.
      const prefetchTssPubs = [];
      for (let i = 0; i < prefetchTssPublicKeys; i++) {
        prefetchTssPubs.push(this.torusSp.getTSSPubKey(this.tkey.tssTag, i));
      }

      // get postbox key.
      let loginPromise;
      if (!params.subVerifier) {
        // single verifier login.
        loginPromise = this.torusSp.customAuthInstance.getTorusKey(verifier, verifierId, {
          verifier_id: verifierId
        }, idToken, _objectSpread(_objectSpread({}, params.extraVerifierParams), params.additionalParams));
      } else {
        // aggregate verifier login
        loginPromise = this.torusSp.customAuthInstance.getAggregateTorusKey(verifier, verifierId, [{
          verifier: params.subVerifier,
          idToken,
          extraVerifierParams: params.extraVerifierParams
        }]);
      }

      // wait for prefetch completed before setup tkey
      const [loginResponse] = await Promise.all([loginPromise, ...prefetchTssPubs]);
      const postBoxKey = this._getPostBoxKey(loginResponse);
      this.torusSp.postboxKey = new BN(postBoxKey, "hex");
      this.updateState({
        postBoxKey,
        postboxKeyNodeIndexes: ((_loginResponse$nodesD3 = loginResponse.nodesData) === null || _loginResponse$nodesD3 === void 0 ? void 0 : _loginResponse$nodesD3.nodeIndexes) || [],
        userInfo: _objectSpread(_objectSpread({}, utils.parseToken(idToken)), {}, {
          verifier,
          verifierId
        }),
        signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData)
      });
      await this.setupTkey(importTssKey);
    } catch (err) {
      utils.log.error("login error", err);
      if (err instanceof core.CoreError) {
        if (err.code === 1302) {
          const newError = errors.default.default(constants.ERRORS.TKEY_SHARES_REQUIRED);
          newError.stack = err.stack;
          throw newError;
        }
      }
      const newError = errors.default.default(err.message);
      newError.stack = err.stack;
      throw newError;
    }
  }
  async handleRedirectResult() {
    this.checkReady();
    try {
      const result = await this.torusSp.customAuthInstance.getRedirectResult();
      if (result.method === customauth.TORUS_METHOD.TRIGGER_LOGIN) {
        var _data$nodesData;
        const data = result.result;
        if (!data) {
          throw errors.default.invalidTorusLoginResponse();
        }
        this.updateState({
          postBoxKey: this._getPostBoxKey(data),
          postboxKeyNodeIndexes: ((_data$nodesData = data.nodesData) === null || _data$nodesData === void 0 ? void 0 : _data$nodesData.nodeIndexes) || [],
          userInfo: data.userInfo,
          signatures: this._getSignatures(data.sessionData.sessionTokenData)
        });
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.verifier;
      } else if (result.method === customauth.TORUS_METHOD.TRIGGER_AGGREGATE_LOGIN) {
        var _data$nodesData2;
        const data = result.result;
        if (!data) {
          throw errors.default.invalidTorusAggregateLoginResponse();
        }
        this.updateState({
          postBoxKey: this._getPostBoxKey(data),
          postboxKeyNodeIndexes: ((_data$nodesData2 = data.nodesData) === null || _data$nodesData2 === void 0 ? void 0 : _data$nodesData2.nodeIndexes) || [],
          userInfo: data.userInfo[0],
          signatures: this._getSignatures(data.sessionData.sessionTokenData)
        });
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.aggregateVerifier;
      } else {
        throw errors.default.unsupportedRedirectMethod();
      }
      const userInfo = this.getUserInfo();
      if (!this.state.postBoxKey) {
        throw errors.default.postBoxKeyMissing("postBoxKey not present in state after processing redirect result.");
      }
      this.torusSp.postboxKey = new BN(this.state.postBoxKey, "hex");
      this.torusSp.verifierId = userInfo.verifierId;
      await this.setupTkey();
    } catch (error) {
      this.resetState();
      utils.log.error("error while handling redirect result", error);
      throw errors.default.default(error.message);
    }
  }
  async inputFactorKey(factorKey) {
    this.checkReady();
    try {
      // input tkey device share when required share > 0 ( or not reconstructed )
      // assumption tkey shares will not changed
      if (!this.tKey.secp256k1Key) {
        const factorKeyMetadata = await this.getFactorKeyMetadata(factorKey);
        await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
      }

      // Finalize initialization.
      await this.tKey.reconstructKey();
      await this.finalizeTkey(factorKey);
    } catch (err) {
      utils.log.error("login error", err);
      if (err instanceof core.CoreError) {
        if (err.code === 1302) {
          throw errors.default.default(constants.ERRORS.TKEY_SHARES_REQUIRED);
        }
      }
      throw errors.default.default(err.message);
    }
  }
  setTssWalletIndex(accountIndex) {
    this.updateState({
      tssPubKey: this.tKey.getTSSPub(accountIndex).toSEC1(this.tkey.tssCurve, false),
      accountIndex
    });
  }
  getCurrentFactorKey() {
    this.checkReady();
    if (!this.state.factorKey) {
      throw errors.default.factorKeyNotPresent("factorKey not present in state when getting current factor key.");
    }
    if (!this.state.tssShareIndex) {
      throw errors.default.tssShareTypeIndexMissing("TSS Share Type (Index) not present in state when getting current factor key.");
    }
    try {
      return {
        factorKey: this.state.factorKey,
        shareType: this.state.tssShareIndex
      };
    } catch (err) {
      utils.log.error("state error", err);
      throw errors.default.default(err.message);
    }
  }
  async enableMFA(enableMFAParams, recoveryFactor = true) {
    this.checkReady();
    const {
      postBoxKey
    } = this.state;
    const hashedFactorKey = utils.getHashedPrivateKey(postBoxKey, this.options.hashedFactorNonce);
    if (!(await this.checkIfFactorKeyValid(hashedFactorKey))) {
      if (this.tKey._localMetadataTransitions[0].length) {
        throw errors.default.commitChangesBeforeMFA();
      }
      throw errors.default.mfaAlreadyEnabled();
    }
    return this.atomicSync(async () => {
      let browserData;
      if (this.isNodejsOrRN(this.options.uxMode)) {
        browserData = {
          browserName: "Node Env",
          browserVersion: "",
          deviceName: "nodejs"
        };
      } else {
        // try {
        const browserInfo = bowser.parse(navigator.userAgent);
        const browserName = `${browserInfo.browser.name}`;
        browserData = {
          browserName,
          browserVersion: browserInfo.browser.version,
          deviceName: browserInfo.os.name
        };
      }
      const deviceFactorKey = new BN(await this.createFactor({
        shareType: constants.TssShareType.DEVICE,
        additionalMetadata: browserData
      }), "hex");
      await this.setDeviceFactor(deviceFactorKey);
      await this.inputFactorKey(new BN(deviceFactorKey, "hex"));
      const hashedFactorPub = tss.getPubKeyPoint(hashedFactorKey, tss.factorKeyCurve);
      await this.deleteFactor(hashedFactorPub, hashedFactorKey);
      await this.deleteMetadataShareBackup(hashedFactorKey);

      // only recovery factor = true
      let backupFactorKey;
      if (recoveryFactor) {
        backupFactorKey = await this.createFactor(_objectSpread({
          shareType: constants.TssShareType.RECOVERY
        }, enableMFAParams));
      }

      // update to undefined for next major release
      return backupFactorKey;
    }).catch(reason => {
      utils.log.error("error enabling MFA:", reason.message);
      const err = errors.default.default(reason.message);
      err.stack = reason.stack;
      throw err;
    });
  }
  // mutation function
  async createFactor(createFactorParams) {
    this.checkReady();
    const {
      shareType
    } = createFactorParams;
    let {
      factorKey,
      shareDescription,
      additionalMetadata
    } = createFactorParams;
    if (!constants.VALID_SHARE_INDICES.includes(shareType)) {
      throw errors.default.newShareIndexInvalid(`Invalid share type provided (${shareType}). Valid share types are ${constants.VALID_SHARE_INDICES}.`);
    }
    if (!factorKey) {
      factorKey = utils.generateFactorKey().private;
    }
    if (!shareDescription) {
      shareDescription = constants.FactorKeyTypeShareDescription.Other;
    }
    if (!additionalMetadata) {
      additionalMetadata = {};
    }
    const factorPub = tss.getPubKeyPoint(factorKey, tss.factorKeyCurve);
    if (this.getTssFactorPub().includes(factorPub.toSEC1(tss.factorKeyCurve, true).toString("hex"))) {
      throw errors.default.factorKeyAlreadyExists();
    }
    return this.atomicSync(async () => {
      await this.copyOrCreateShare(shareType, factorPub);
      await this.backupMetadataShare(factorKey);
      await this.addFactorDescription({
        factorKey,
        shareDescription,
        additionalMetadata,
        updateMetadata: false
      });
      return utils.scalarBNToBufferSEC1(factorKey).toString("hex");
    }).catch(reason => {
      utils.log.error("error creating factor:", reason.message);
      const err = errors.default.default(`error creating factor: ${reason.message}`);
      err.stack = reason.stack;
      throw err;
    });
  }

  /**
   * Get public key point in SEC1 format.
   */
  getPubKey() {
    const {
      tssPubKey
    } = this.state;
    return Buffer.from(tssPubKey);
  }

  /**
   * Get public key point.
   */
  getPubKeyPoint() {
    const {
      tssPubKey
    } = this.state;
    return commonTypes.Point.fromSEC1(this.tkey.tssCurve, tssPubKey.toString("hex"));
  }

  /**
   * Get public key in ed25519 format.
   *
   * Throws an error if keytype is not compatible with ed25519.
   */
  getPubKeyEd25519() {
    const p = this.tkey.tssCurve.keyFromPublic(this.getPubKey()).getPublic();
    return utils.ed25519().keyFromPublic(p).getPublic();
  }
  async precompute_secp256k1() {
    this.wasmLib = await this.loadTssWasm();
    // PreSetup
    const {
      tssShareIndex
    } = this.state;
    const tssPubKey = this.getPubKeyPoint();
    const {
      torusNodeTSSEndpoints
    } = fndBase.fetchLocalConfig(this.options.web3AuthNetwork, this.keyType);
    if (!this.state.factorKey) {
      throw errors.default.factorKeyNotPresent("factorKey not present in state when signing.");
    }
    const {
      tssShare
    } = await this.tKey.getTSSShare(this.state.factorKey, {
      accountIndex: 0
    });
    const tssNonce = this.getTssNonce();
    if (!tssPubKey || !torusNodeTSSEndpoints) {
      throw errors.default.tssPublicKeyOrEndpointsMissing();
    }

    // session is needed for authentication to the web3auth infrastructure holding the factor 1
    const randomSessionNonce = utils.generateSessionNonce();
    const currentSession = utils.getSessionId(this.verifier, this.verifierId, this.tKey.tssTag, tssNonce, randomSessionNonce);
    const parties = 4;
    const clientIndex = parties - 1;
    // 1. setup
    // generate endpoints for servers
    const {
      nodeIndexes
    } = await this.torusSp.getTSSPubKey(this.tKey.tssTag, this.tKey.metadata.tssNonces[this.tKey.tssTag]);
    const {
      endpoints,
      tssWSEndpoints,
      partyIndexes,
      nodeIndexesReturned: participatingServerDKGIndexes
    } = utils.generateTSSEndpoints(torusNodeTSSEndpoints, parties, clientIndex, nodeIndexes);

    // Setup sockets.
    const sockets = await tssClient.setupSockets(tssWSEndpoints, randomSessionNonce);
    const dklsCoeff = tssClient.getDKLSCoeff(true, participatingServerDKGIndexes, tssShareIndex);
    const denormalisedShare = dklsCoeff.mul(tssShare).umod(commonTypes.secp256k1.curve.n);
    const accountNonce = this.tkey.computeAccountNonce(this.state.accountIndex);
    const derivedShare = denormalisedShare.add(accountNonce).umod(commonTypes.secp256k1.curve.n);
    const share = utils.scalarBNToBufferSEC1(derivedShare).toString("base64");
    if (!currentSession) {
      throw errors.default.activeSessionNotFound();
    }
    const {
      signatures
    } = this;
    if (!signatures) {
      throw errors.default.signaturesNotPresent();
    }

    // Client lib expects pub key in XY-format, base64-encoded.
    const tssPubKeyBase64 = Buffer.from(tssPubKey.toSEC1(commonTypes.secp256k1).subarray(1)).toString("base64");
    const client = new tssClient.Client(currentSession, clientIndex, partyIndexes, endpoints, sockets, share, tssPubKeyBase64, true, this.wasmLib);
    const serverCoeffs = {};
    for (let i = 0; i < participatingServerDKGIndexes.length; i++) {
      const serverIndex = participatingServerDKGIndexes[i];
      serverCoeffs[serverIndex] = tssClient.getDKLSCoeff(false, participatingServerDKGIndexes, tssShareIndex, serverIndex).toString("hex");
    }
    client.precompute({
      signatures,
      server_coeffs: serverCoeffs,
      nonce: utils.scalarBNToBufferSEC1(this.getAccountNonce()).toString("base64")
    });
    await client.ready().catch(err => {
      client.cleanup({
        signatures,
        server_coeffs: serverCoeffs
      });
      throw err;
    });
    return {
      client,
      serverCoeffs
    };
  }
  async sign(data, hashed = false, secp256k1Precompute) {
    this.wasmLib = await this.loadTssWasm();
    if (this.keyType === commonTypes.KeyType.secp256k1) {
      const sig = await this.sign_ECDSA_secp256k1(data, hashed, secp256k1Precompute);
      return Buffer.concat([sig.r, sig.s, Buffer.from([sig.v])]);
    } else if (this.keyType === commonTypes.KeyType.ed25519) {
      return this.sign_ed25519(data, hashed);
    }
    throw errors.default.default(`sign not supported for key type ${this.keyType}`);
  }

  // mutation function
  async deleteFactor(factorPub, factorKey) {
    if (!this.state.factorKey) {
      throw errors.default.factorKeyNotPresent("factorKey not present in state when deleting a factor.");
    }
    if (!this.tKey.metadata.factorPubs) {
      throw errors.default.factorPubsMissing();
    }
    await this.atomicSync(async () => {
      const remainingFactors = this.tKey.metadata.factorPubs[this.tKey.tssTag].length || 0;
      if (remainingFactors <= 1) {
        throw errors.default.cannotDeleteLastFactor("Cannot delete last factor");
      }
      const fpp = factorPub;
      const stateFpp = tss.getPubKeyPoint(this.state.factorKey, tss.factorKeyCurve);
      if (fpp.equals(stateFpp)) {
        throw errors.default.factorInUseCannotBeDeleted("Cannot delete current active factor");
      }
      await this.tKey.deleteFactorPub({
        factorKey: this.state.factorKey,
        deleteFactorPub: factorPub,
        authSignatures: this.signatures
      });
      const factorPubHex = fpp.toSEC1(tss.factorKeyCurve, true).toString("hex");
      const allDesc = this.tKey.metadata.getShareDescription();
      const keyDesc = allDesc[factorPubHex];
      if (keyDesc) {
        await Promise.all(keyDesc.map(async desc => {
          var _this$tKey;
          return (_this$tKey = this.tKey) === null || _this$tKey === void 0 ? void 0 : _this$tKey.metadata.deleteShareDescription(factorPubHex, desc);
        }));
      }

      // delete factorKey share metadata if factorkey is provided
      if (factorKey) {
        const factorKeyBN = new BN(factorKey, "hex");
        const derivedFactorPub = tss.getPubKeyPoint(factorKeyBN, tss.factorKeyCurve);
        // only delete if factorPub matches
        if (derivedFactorPub.equals(fpp)) {
          await this.deleteMetadataShareBackup(factorKeyBN);
        }
      }
    });
  }
  async logout() {
    var _this$sessionManager2;
    if ((_this$sessionManager2 = this.sessionManager) !== null && _this$sessionManager2 !== void 0 && _this$sessionManager2.sessionId) {
      await this.sessionManager.invalidateSession();
    }
    // to accommodate async storage
    await this.currentStorage.set("sessionId", "");
    this.resetState();
    await this.init({
      handleRedirectResult: false,
      rehydrate: false
    });
  }
  getUserInfo() {
    if (!this.state.userInfo) {
      throw errors.default.userNotLoggedIn();
    }
    return this.state.userInfo;
  }
  getKeyDetails() {
    this.checkReady();
    const tkeyDetails = this.tKey.getKeyDetails();
    const tssPubKey = this.state.tssPubKey ? commonTypes.Point.fromSEC1(this.tkey.tssCurve, this.state.tssPubKey.toString("hex")) : undefined;
    const factors = this.tKey.metadata.factorPubs ? this.tKey.metadata.factorPubs[this.tKey.tssTag] : [];
    const keyDetails = {
      // use tkey's for now
      requiredFactors: tkeyDetails.requiredShares,
      threshold: tkeyDetails.threshold,
      totalFactors: factors.length + 1,
      shareDescriptions: this.tKey.getMetadata().getShareDescription(),
      metadataPubKey: tkeyDetails.pubKey,
      tssPubKey,
      keyType: this.keyType
    };
    return keyDetails;
  }
  async commitChanges() {
    this.checkReady();
    if (!this.state.factorKey) {
      throw errors.default.factorKeyNotPresent("factorKey not present in state when committing changes.");
    }
    try {
      // in case for manualsync = true, _syncShareMetadata will not call syncLocalMetadataTransitions()
      // it will not create a new LocalMetadataTransition
      // manual call syncLocalMetadataTransitions() required to sync local transitions to storage
      await this.tKey._syncShareMetadata();
      await this.tKey.syncLocalMetadataTransitions();
    } catch (error) {
      utils.log.error("sync metadata error", error);
      throw error;
    }
  }
  async setManualSync(manualSync) {
    this.checkReady();
    // sync local transistion to storage before allow changes
    await this.tKey.syncLocalMetadataTransitions();
    this.options.manualSync = manualSync;
    this.tKey.manualSync = manualSync;
  }

  // device factor
  async setDeviceFactor(factorKey, replace = false) {
    if (!replace) {
      const existingFactor = await this.getDeviceFactor();
      if (existingFactor) {
        throw errors.default.default("Device factor already exists");
      }
    }
    const metadata = this.tKey.getMetadata();
    const tkeyPubX = metadata.pubKey.x.toString(16, constants.FIELD_ELEMENT_HEX_LEN);
    await this.currentStorage.set(tkeyPubX, JSON.stringify({
      factorKey: factorKey.toString("hex").padStart(64, "0")
    }));
  }
  async getDeviceFactor() {
    const metadata = this.tKey.getMetadata();
    const tkeyPubX = metadata.pubKey.x.toString(16, constants.FIELD_ELEMENT_HEX_LEN);
    const tKeyLocalStoreString = await this.currentStorage.get(tkeyPubX);
    const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}");
    return tKeyLocalStore.factorKey;
  }

  /**
   * WARNING: Use with caution. This will export the private signing key.
   *
   * Exports the private key scalar for the current account index.
   *
   * For keytype ed25519, consider using _UNSAFE_exportTssEd25519Seed.
   */
  async _UNSAFE_exportTssKey() {
    if (this.keyType !== commonTypes.KeyType.secp256k1) {
      throw errors.default.default("Wrong KeyType. Method can only be used when KeyType is secp256k1");
    }
    if (!this.state.factorKey) {
      throw errors.default.factorKeyNotPresent("factorKey not present in state when exporting tss key.");
    }
    if (!this.state.signatures) {
      throw errors.default.signaturesNotPresent("Signatures not present in state when exporting tss key.");
    }
    const exportTssKey0 = await this.tKey._UNSAFE_exportTssKey({
      factorKey: this.state.factorKey,
      authSignatures: this.state.signatures
    });
    const accountNonce = this.getAccountNonce();
    const tssKey = exportTssKey0.add(accountNonce).umod(this.tKey.tssCurve.n);
    return tssKey.toString("hex", constants.FIELD_ELEMENT_HEX_LEN);
  }

  /**
   * WARNING: Use with caution. This will export the private signing key.
   *
   * Attempts to export the ed25519 private key seed. Only works if import key
   * flow has been used.
   */
  async _UNSAFE_exportTssEd25519Seed() {
    if (this.keyType !== commonTypes.KeyType.ed25519) {
      throw errors.default.default("Wrong KeyType. Method can only be used when KeyType is ed25519");
    }
    if (!this.state.factorKey) throw errors.default.factorKeyNotPresent("factorKey not present in state when exporting tss ed25519 seed.");
    if (!this.state.signatures) throw errors.default.signaturesNotPresent("Signatures not present in state when exporting tss ed25519 seed.");
    try {
      const exportEd25519Seed = await this.tKey._UNSAFE_exportTssEd25519Seed({
        factorKey: this.state.factorKey,
        authSignatures: this.state.signatures
      });
      return exportEd25519Seed;
    } catch (error) {
      throw errors.default.default(`Error exporting ed25519 seed: ${error}`);
    }
  }
  updateState(newState) {
    this.state = _objectSpread(_objectSpread({}, this.state), newState);
  }
  async atomicSync(f) {
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
      throw error;
    } finally {
      this.atomicCallStackCounter -= 1;
      if (this.atomicCallStackCounter === 0) {
        this.tkey.manualSync = this.options.manualSync;
      }
    }
  }
  async importTssKey(tssKey, factorPub, newTSSIndex = constants.TssShareType.DEVICE) {
    if (!this.state.signatures) {
      throw errors.default.signaturesNotPresent("Signatures not present in state when importing tss key.");
    }
    await this.tKey.importTssKey({
      tag: this.tKey.tssTag,
      importKey: Buffer.from(tssKey, "hex"),
      factorPub,
      newTSSIndex
    }, {
      authSignatures: this.state.signatures
    });
  }
  getTssNonce() {
    if (!this.tKey.metadata.tssNonces || this.tKey.metadata.tssNonces[this.tKey.tssTag] === undefined) {
      throw errors.default.tssNoncesMissing(`tssNonce not present for tag ${this.tKey.tssTag}`);
    }
    const tssNonce = this.tKey.metadata.tssNonces[this.tKey.tssTag];
    return tssNonce;
  }
  async setupTkey(providedImportTssKey) {
    if (!this.state.postBoxKey) {
      throw errors.default.userNotLoggedIn();
    }
    const existingUser = await this.isMetadataPresent(this.state.postBoxKey);
    let importTssKey = providedImportTssKey;
    if (!existingUser) {
      if (!importTssKey && this.useClientGeneratedTSSKey) {
        if (this.keyType === commonTypes.KeyType.ed25519) {
          const k = utils.generateEd25519Seed();
          importTssKey = k.toString("hex");
        } else if (this.keyType === commonTypes.KeyType.secp256k1) {
          const k = commonTypes.secp256k1.genKeyPair().getPrivate();
          importTssKey = utils.scalarBNToBufferSEC1(k).toString("hex");
        } else {
          throw errors.default.default("Unsupported key type");
        }
      }
      await this.handleNewUser(importTssKey);
    } else {
      if (importTssKey) {
        throw errors.default.tssKeyImportNotAllowed();
      }
      await this.handleExistingUser();
    }
  }

  // mutation function
  async handleNewUser(importTssKey) {
    await this.atomicSync(async () => {
      // Generate or use hash factor and initialize tkey with it.
      let factorKey;
      if (this.options.disableHashedFactorKey) {
        factorKey = utils.generateFactorKey().private;
        // delete previous hashed factorKey if present
        const hashedFactorKey = utils.getHashedPrivateKey(this.state.postBoxKey, this.options.hashedFactorNonce);
        await this.deleteMetadataShareBackup(hashedFactorKey);
      } else {
        factorKey = utils.getHashedPrivateKey(this.state.postBoxKey, this.options.hashedFactorNonce);
      }
      const deviceTSSIndex = constants.TssShareType.DEVICE;
      const factorPub = tss.getPubKeyPoint(factorKey, tss.factorKeyCurve);
      if (!importTssKey) {
        const ec = new elliptic.ec(this.keyType);
        const deviceTSSShare = ec.genKeyPair().getPrivate();
        await this.tKey.initialize({
          factorPub,
          deviceTSSShare,
          deviceTSSIndex
        });
      } else {
        await this.tKey.initialize({
          skipTssInit: true
        });
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
          shareDescription: constants.FactorKeyTypeShareDescription.Other,
          updateMetadata: false
        });
      } else {
        await this.addFactorDescription({
          factorKey,
          shareDescription: constants.FactorKeyTypeShareDescription.HashedShare,
          updateMetadata: false
        });
      }
    });
  }
  async handleExistingUser() {
    await this.tKey.initialize({
      neverInitializeNewKey: true
    });
    if (this.options.disableHashedFactorKey) {
      return;
    }
    const hashedFactorKey = utils.getHashedPrivateKey(this.state.postBoxKey, this.options.hashedFactorNonce);
    this.state.factorKey = hashedFactorKey;
    if (await this.checkIfFactorKeyValid(hashedFactorKey)) {
      // Initialize tkey with existing hashed share if available.
      const factorKeyMetadata = await this.getFactorKeyMetadata(hashedFactorKey);
      try {
        await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
        await this.tKey.reconstructKey();
        await this.finalizeTkey(hashedFactorKey);
      } catch (err) {
        utils.log.error("error initializing tkey with hashed share", err);
      }
    } else {
      var _this$tKey2;
      const factorKeyMetadata = await ((_this$tKey2 = this.tKey) === null || _this$tKey2 === void 0 ? void 0 : _this$tKey2.readMetadata(hashedFactorKey));
      if (factorKeyMetadata.message === "SHARE_DELETED") {
        // throw CoreKitError.hashedFactorDeleted();
        utils.log.warn("hashed factor deleted");
      }
    }
  }
  async finalizeTkey(factorKey) {
    if (this.state.accountIndex !== 0) {
      utils.log.warn("AccountIndex should be 0");
      this.state.accountIndex = 0;
    }
    // Read tss meta data.
    const {
      tssIndex: tssShareIndex
    } = await this.tKey.getTSSShare(factorKey);
    const tssPubKey = this.tKey.getTSSPub().toSEC1(this.tkey.tssCurve, false);
    this.updateState({
      tssShareIndex,
      tssPubKey,
      factorKey
    });
    await this.createSession();
  }
  checkReady() {
    if (!this.ready) {
      throw errors.default.mpcCoreKitNotInitialized();
    }
  }
  async rehydrateSession(result) {
    try {
      this.checkReady();
      const factorKey = new BN(result.factorKey, "hex");
      if (!factorKey) {
        throw errors.default.providedFactorKeyInvalid();
      }
      const postBoxKey = result.postBoxKey || result.oAuthKey;
      if (!postBoxKey) {
        throw errors.default.default("postBoxKey or oAuthKey not present in session data");
      }
      this.torusSp.postboxKey = new BN(postBoxKey, "hex");
      this.torusSp.verifierName = result.userInfo.aggregateVerifier || result.userInfo.verifier;
      this.torusSp.verifierId = result.userInfo.verifierId;
      const factorKeyMetadata = await this.getFactorKeyMetadata(factorKey);
      await this.tKey.initialize({
        neverInitializeNewKey: true
      });
      await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
      await this.tKey.reconstructKey();
      this.updateState({
        factorKey: new BN(result.factorKey, "hex"),
        postBoxKey,
        postboxKeyNodeIndexes: result.postboxKeyNodeIndexes || [],
        tssShareIndex: result.tssShareIndex,
        tssPubKey: this.tkey.getTSSPub().toSEC1(this.tKey.tssCurve, false),
        signatures: result.signatures,
        userInfo: result.userInfo
      });
    } catch (err) {
      utils.log.warn("failed to authorize session", err);
    }
  }
  async createSession() {
    if (!this.options.disableSessionManager && !this.sessionManager) {
      throw new Error("sessionManager is not available");
    }
    try {
      const sessionId = sessionManager.SessionManager.generateRandomSessionKey();
      this.sessionManager.sessionId = sessionId;
      const {
        postBoxKey,
        factorKey,
        userInfo,
        tssShareIndex,
        tssPubKey,
        postboxKeyNodeIndexes
      } = this.state;
      if (!this.state.factorKey) {
        throw errors.default.factorKeyNotPresent("factorKey not present in state when creating session.");
      }
      const {
        tssShare
      } = await this.tKey.getTSSShare(this.state.factorKey, {
        accountIndex: this.state.accountIndex
      });
      if (!postBoxKey || !factorKey || !tssShare || !tssPubKey || !userInfo) {
        throw errors.default.userNotLoggedIn();
      }
      const payload = {
        postBoxKey,
        postboxKeyNodeIndexes: postboxKeyNodeIndexes || [],
        factorKey: factorKey === null || factorKey === void 0 ? void 0 : factorKey.toString("hex"),
        tssShareIndex: tssShareIndex,
        tssPubKey: Buffer.from(tssPubKey).toString("hex"),
        signatures: this.signatures,
        userInfo
      };
      await this.sessionManager.createSession(payload);
      // to accommodate async storage
      await this.currentStorage.set("sessionId", sessionId);
    } catch (err) {
      utils.log.error("error creating session", err);
    }
  }
  async isMetadataPresent(privateKey) {
    var _this$tKey3;
    const privateKeyBN = new BN(privateKey, "hex");
    const metadata = await ((_this$tKey3 = this.tKey) === null || _this$tKey3 === void 0 ? void 0 : _this$tKey3.readMetadata(privateKeyBN));
    if (metadata && metadata.message !== "KEY_NOT_FOUND") {
      return true;
    }
    return false;
  }
  async checkIfFactorKeyValid(factorKey) {
    var _this$tKey4;
    this.checkReady();
    const factorKeyMetadata = await ((_this$tKey4 = this.tKey) === null || _this$tKey4 === void 0 ? void 0 : _this$tKey4.readMetadata(factorKey));
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND" || factorKeyMetadata.message === "SHARE_DELETED") {
      return false;
    }
    return true;
  }
  async getFactorKeyMetadata(factorKey) {
    var _this$tKey5;
    this.checkReady();
    const factorKeyMetadata = await ((_this$tKey5 = this.tKey) === null || _this$tKey5 === void 0 ? void 0 : _this$tKey5.readMetadata(factorKey));
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND") {
      throw errors.default.noMetadataFound();
    }
    return commonTypes.ShareStore.fromJSON(factorKeyMetadata);
  }

  /**
   * Copies a share and makes it available under a new factor key. If no share
   * exists at the specified share index, a new share is created.
   * @param newFactorTSSIndex - The index of the share to copy.
   * @param newFactorPub - The public key of the new share.
   */
  async copyOrCreateShare(newFactorTSSIndex, newFactorPub) {
    this.checkReady();
    if (!this.tKey.metadata.factorPubs || !Array.isArray(this.tKey.metadata.factorPubs[this.tKey.tssTag])) {
      throw errors.default.factorPubsMissing("'factorPubs' is missing in the metadata. Failed to copy factor public key.");
    }
    if (!this.tKey.metadata.factorEncs || typeof this.tKey.metadata.factorEncs[this.tKey.tssTag] !== "object") {
      throw errors.default.factorEncsMissing("'factorEncs' is missing in the metadata. Failed to copy factor public key.");
    }
    if (!this.state.factorKey) {
      throw errors.default.factorKeyNotPresent("factorKey not present in state when copying or creating a share.");
    }
    if (constants.VALID_SHARE_INDICES.indexOf(newFactorTSSIndex) === -1) {
      throw errors.default.newShareIndexInvalid(`Invalid share type provided (${newFactorTSSIndex}). Valid share types are ${constants.VALID_SHARE_INDICES}.`);
    }
    if (this.tKey.metadata.factorPubs[this.tKey.tssTag].length >= constants.MAX_FACTORS) {
      throw errors.default.maximumFactorsReached(`The maximum number of allowable factors (${constants.MAX_FACTORS}) has been reached.`);
    }

    // Generate new share.
    await this.tkey.addFactorPub({
      existingFactorKey: this.state.factorKey,
      authSignatures: this.signatures,
      newFactorPub,
      newTSSIndex: newFactorTSSIndex,
      refreshShares: this.state.tssShareIndex !== newFactorTSSIndex // Refresh shares if we have a new factor key index.
    });
  }
  async getMetadataShare() {
    try {
      var _this$tKey6, _this$tKey7;
      const polyId = (_this$tKey6 = this.tKey) === null || _this$tKey6 === void 0 ? void 0 : _this$tKey6.metadata.getLatestPublicPolynomial().getPolynomialID();
      const shares = (_this$tKey7 = this.tKey) === null || _this$tKey7 === void 0 ? void 0 : _this$tKey7.shares[polyId];
      let share = null;
      for (const shareIndex in shares) {
        if (shareIndex !== constants.SOCIAL_TKEY_INDEX.toString()) {
          share = shares[shareIndex];
        }
      }
      if (!share) {
        throw errors.default.noMetadataShareFound();
      }
      return share;
    } catch (err) {
      utils.log.error("create device share error", err);
      throw errors.default.default(err.message);
    }
  }
  async deleteMetadataShareBackup(factorKey) {
    var _this$tkey, _this$tkey2;
    await this.tKey.addLocalMetadataTransitions({
      input: [{
        message: commonTypes.SHARE_DELETED,
        dateAdded: Date.now()
      }],
      privKey: [factorKey]
    });
    if (!((_this$tkey = this.tkey) !== null && _this$tkey !== void 0 && _this$tkey.manualSync)) await ((_this$tkey2 = this.tkey) === null || _this$tkey2 === void 0 ? void 0 : _this$tkey2.syncLocalMetadataTransitions());
  }
  async backupMetadataShare(factorKey) {
    var _this$tKey8, _this$tkey3, _this$tkey4;
    const metadataShare = await this.getMetadataShare();

    // Set metadata for factor key backup
    await ((_this$tKey8 = this.tKey) === null || _this$tKey8 === void 0 ? void 0 : _this$tKey8.addLocalMetadataTransitions({
      input: [metadataShare],
      privKey: [factorKey]
    }));
    if (!((_this$tkey3 = this.tkey) !== null && _this$tkey3 !== void 0 && _this$tkey3.manualSync)) await ((_this$tkey4 = this.tkey) === null || _this$tkey4 === void 0 ? void 0 : _this$tkey4.syncLocalMetadataTransitions());
  }
  async addFactorDescription(args) {
    var _this$tKey9;
    const {
      factorKey,
      shareDescription,
      updateMetadata
    } = args;
    let {
      additionalMetadata
    } = args;
    if (!additionalMetadata) {
      additionalMetadata = {};
    }
    const {
      tssIndex
    } = await this.tKey.getTSSShare(factorKey);
    const factorPoint = tss.getPubKeyPoint(factorKey, tss.factorKeyCurve);
    const factorPub = factorPoint.toSEC1(tss.factorKeyCurve, true).toString("hex");
    const params = _objectSpread(_objectSpread({
      module: shareDescription,
      dateAdded: Date.now()
    }, additionalMetadata), {}, {
      tssShareIndex: tssIndex
    });
    await ((_this$tKey9 = this.tKey) === null || _this$tKey9 === void 0 ? void 0 : _this$tKey9.addShareDescription(factorPub, JSON.stringify(params), updateMetadata));
  }
  resetState() {
    this.ready = false;
    this.tkey = null;
    this.torusSp = null;
    this.storageLayer = null;
    this.state = {
      accountIndex: 0
    };
  }
  _getPostBoxKey(result) {
    return torus_js.Torus.getPostboxKey(result);
  }
  _getSignatures(sessionData) {
    // There is a check in torus.js which pushes undefined to session data in case
    // that particular node call fails.
    // and before returning we are not filtering out undefined vals in torus.js
    // TODO: fix this in torus.js
    return sessionData.filter(session => !!session).map(session => JSON.stringify({
      data: session.token,
      sig: session.signature
    }));
  }
  isNodejsOrRN(params) {
    const mode = params;
    return mode === "nodejs" || mode === "react-native";
  }
  async featureRequest() {
    const accessUrl = constants$1.SIGNER_MAP[this.options.web3AuthNetwork];
    const accessRequest = {
      network: this.options.web3AuthNetwork,
      client_id: this.options.web3AuthClientId,
      is_mpc_core_kit: "true",
      enable_gating: "true",
      session_time: this.options.sessionTime.toString()
    };
    const url = new URL(`${accessUrl}/api/feature-access`);
    url.search = new URLSearchParams(accessRequest).toString();
    const result = await fetch(url);
    if (result.status !== 200) {
      // reset state on no mpc access
      this.resetState();
      const errMessage = await result.json();
      throw errors.default.default(errMessage.error);
    }
    return result.json();
  }
  getAccountNonce() {
    return this.tkey.computeAccountNonce(this.state.accountIndex);
  }
  async sign_ECDSA_secp256k1(data, hashed = false, precomputedTssClient) {
    const executeSign = async (client, serverCoeffs, hashedData, signatures) => {
      const {
        r,
        s,
        recoveryParam
      } = await client.sign(hashedData.toString("base64"), true, "", "keccak256", {
        signatures
      });
      // skip await cleanup
      client.cleanup({
        signatures,
        server_coeffs: serverCoeffs
      });
      return {
        v: recoveryParam,
        r: utils.scalarBNToBufferSEC1(r),
        s: utils.scalarBNToBufferSEC1(s)
      };
    };
    if (!hashed) {
      data = metadataHelpers.keccak256(data);
    }
    const isAlreadyPrecomputed = (precomputedTssClient === null || precomputedTssClient === void 0 ? void 0 : precomputedTssClient.client) && (precomputedTssClient === null || precomputedTssClient === void 0 ? void 0 : precomputedTssClient.serverCoeffs);
    const {
      client,
      serverCoeffs
    } = isAlreadyPrecomputed ? precomputedTssClient : await this.precompute_secp256k1();
    const {
      signatures
    } = this;
    if (!signatures) {
      throw errors.default.signaturesNotPresent();
    }
    try {
      return await executeSign(client, serverCoeffs, data, signatures);
    } catch (error) {
      if (!isAlreadyPrecomputed) {
        throw error;
      }
      // Retry with new client if precomputed client failed, this is to handle the case when precomputed session might have expired
      const {
        client: newClient,
        serverCoeffs: newServerCoeffs
      } = await this.precompute_secp256k1();
      const result = await executeSign(newClient, newServerCoeffs, data, signatures);
      return result;
    }
  }
  async sign_ed25519(data, hashed = false) {
    if (hashed) {
      throw errors.default.default("hashed data not supported for ed25519");
    }
    const nodeDetails = fndBase.fetchLocalConfig(this.options.web3AuthNetwork, "ed25519");
    if (!nodeDetails.torusNodeTSSEndpoints) {
      throw errors.default.default("could not fetch tss node endpoints");
    }

    // Endpoints must end with backslash, but URLs returned by
    // `fetch-node-details` don't have it.
    const ED25519_ENDPOINTS = nodeDetails.torusNodeTSSEndpoints.map((ep, i) => ({
      index: nodeDetails.torusIndexes[i],
      url: `${ep}/`
    }));

    // Select endpoints and derive party indices.
    const serverThreshold = Math.floor(ED25519_ENDPOINTS.length / 2) + 1;
    const endpoints = utils.sampleEndpoints(ED25519_ENDPOINTS, serverThreshold);
    const serverXCoords = endpoints.map(x => x.index);
    const clientXCoord = Math.max(...endpoints.map(ep => ep.index)) + 1;

    // Derive share coefficients for flat hierarchy.
    const ec = new ellipticWrapper.Ed25519Curve();
    const {
      serverCoefficients,
      clientCoefficient
    } = utils.deriveShareCoefficients(ec, serverXCoords, clientXCoord, this.state.tssShareIndex);

    // Get pub key.
    const tssPubKey = await this.getPubKey();
    const tssPubKeyPoint = ec.keyFromPublic(tssPubKey).getPublic();

    // Get client key share and adjust by coefficient.
    if (this.state.accountIndex !== 0) {
      throw errors.default.default("Account index not supported for ed25519");
    }
    const {
      tssShare
    } = await this.tKey.getTSSShare(this.state.factorKey);
    const clientShareAdjusted = tssShare.mul(clientCoefficient).umod(ec.n);
    const clientShareAdjustedHex = ec.scalarToBuffer(clientShareAdjusted, Buffer).toString("hex");

    // Generate session identifier.
    const tssNonce = this.getTssNonce();
    const sessionNonce = utils.generateSessionNonce();
    const session = utils.getSessionId(this.verifier, this.verifierId, this.tKey.tssTag, tssNonce, sessionNonce);

    // Run signing protocol.
    const serverURLs = endpoints.map(x => x.url);
    const pubKeyHex = ec.pointToBuffer(tssPubKeyPoint, Buffer).toString("hex");
    const serverCoefficientsHex = serverCoefficients.map(c => ec.scalarToBuffer(c, Buffer).toString("hex"));
    const signature = await tssFrostClient.sign(this.wasmLib, session, this.signatures, serverXCoords, serverURLs, clientXCoord, clientShareAdjustedHex, pubKeyHex, data, serverCoefficientsHex);
    utils.log.info(`signature: ${signature}`);
    return Buffer.from(signature, "hex");
  }
  async loadTssWasm() {
    if (this.wasmLib) return this.wasmLib;
    if (typeof this._tssLib.load === "function") {
      // dont wait for wasm to be loaded, we can reload it during signing if not loaded
      return this._tssLib.load();
    } else if (this._tssLib.lib) {
      return this._tssLib.lib;
    }
  }
}

exports.Web3AuthMPCCoreKit = Web3AuthMPCCoreKit;
