/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 796:
/***/ ((module) => {

module.exports = require("@toruslabs/tss-lib");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/create fake namespace object */
/******/ 	(() => {
/******/ 		var getProto = Object.getPrototypeOf ? (obj) => (Object.getPrototypeOf(obj)) : (obj) => (obj.__proto__);
/******/ 		var leafPrototypes;
/******/ 		// create a fake namespace object
/******/ 		// mode & 1: value is a module id, require it
/******/ 		// mode & 2: merge all properties of value into the ns
/******/ 		// mode & 4: return value when already ns object
/******/ 		// mode & 16: return value when it's Promise-like
/******/ 		// mode & 8|1: behave like require
/******/ 		__webpack_require__.t = function(value, mode) {
/******/ 			if(mode & 1) value = this(value);
/******/ 			if(mode & 8) return value;
/******/ 			if(typeof value === 'object' && value) {
/******/ 				if((mode & 4) && value.__esModule) return value;
/******/ 				if((mode & 16) && typeof value.then === 'function') return value;
/******/ 			}
/******/ 			var ns = Object.create(null);
/******/ 			__webpack_require__.r(ns);
/******/ 			var def = {};
/******/ 			leafPrototypes = leafPrototypes || [null, getProto({}), getProto([]), getProto(getProto)];
/******/ 			for(var current = mode & 2 && value; typeof current == 'object' && !~leafPrototypes.indexOf(current); current = getProto(current)) {
/******/ 				Object.getOwnPropertyNames(current).forEach((key) => (def[key] = () => (value[key])));
/******/ 			}
/******/ 			def['default'] = () => (value);
/******/ 			__webpack_require__.d(ns, def);
/******/ 			return ns;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  BrowserStorage: () => (/* reexport */ BrowserStorage),
  COREKIT_STATUS: () => (/* reexport */ COREKIT_STATUS),
  CURVE: () => (/* reexport */ CURVE),
  DEFAULT_CHAIN_CONFIG: () => (/* reexport */ DEFAULT_CHAIN_CONFIG),
  DELIMITERS: () => (/* reexport */ DELIMITERS),
  ERRORS: () => (/* reexport */ ERRORS),
  FIELD_ELEMENT_HEX_LEN: () => (/* reexport */ FIELD_ELEMENT_HEX_LEN),
  FactorKeyTypeShareDescription: () => (/* reexport */ FactorKeyTypeShareDescription),
  MAX_FACTORS: () => (/* reexport */ MAX_FACTORS),
  MemoryStorage: () => (/* reexport */ MemoryStorage),
  Point: () => (/* reexport */ Point),
  SCALAR_LEN: () => (/* reexport */ SCALAR_LEN),
  SOCIAL_FACTOR_INDEX: () => (/* reexport */ SOCIAL_FACTOR_INDEX),
  SOCIAL_TKEY_INDEX: () => (/* reexport */ SOCIAL_TKEY_INDEX),
  TssSecurityQuestion: () => (/* reexport */ TssSecurityQuestion),
  TssSecurityQuestionStore: () => (/* reexport */ TssSecurityQuestionStore),
  TssShareType: () => (/* reexport */ TssShareType),
  USER_PATH: () => (/* reexport */ USER_PATH),
  VALID_SHARE_INDICES: () => (/* reexport */ VALID_SHARE_INDICES),
  WEB3AUTH_NETWORK: () => (/* reexport */ WEB3AUTH_NETWORK),
  Web3AuthMPCCoreKit: () => (/* reexport */ Web3AuthMPCCoreKit),
  addFactorAndRefresh: () => (/* reexport */ addFactorAndRefresh),
  deleteFactorAndRefresh: () => (/* reexport */ deleteFactorAndRefresh),
  generateFactorKey: () => (/* reexport */ generateFactorKey),
  generateTSSEndpoints: () => (/* reexport */ generateTSSEndpoints),
  getHashedPrivateKey: () => (/* reexport */ getHashedPrivateKey),
  getWebBrowserFactor: () => (/* reexport */ getWebBrowserFactor),
  keyToMnemonic: () => (/* reexport */ keyToMnemonic),
  mnemonicToKey: () => (/* reexport */ mnemonicToKey),
  parseToken: () => (/* reexport */ parseToken),
  scalarBNToBufferSEC1: () => (/* reexport */ scalarBNToBufferSEC1),
  storageAvailable: () => (/* reexport */ storageAvailable),
  storeWebBrowserFactor: () => (/* reexport */ storeWebBrowserFactor)
});

;// CONCATENATED MODULE: external "@toruslabs/constants"
const constants_namespaceObject = require("@toruslabs/constants");
;// CONCATENATED MODULE: external "@web3auth/base"
const base_namespaceObject = require("@web3auth/base");
;// CONCATENATED MODULE: external "elliptic"
const external_elliptic_namespaceObject = require("elliptic");
;// CONCATENATED MODULE: ./src/constants.ts



const DEFAULT_CHAIN_CONFIG = {
  chainNamespace: base_namespaceObject.CHAIN_NAMESPACES.EIP155,
  chainId: "0x5",
  rpcTarget: "https://rpc.ankr.com/eth_goerli",
  displayName: "Goerli Testnet",
  blockExplorer: "https://goerli.etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
  decimals: 18
};
const WEB3AUTH_NETWORK = {
  MAINNET: constants_namespaceObject.TORUS_SAPPHIRE_NETWORK.SAPPHIRE_MAINNET,
  DEVNET: constants_namespaceObject.TORUS_SAPPHIRE_NETWORK.SAPPHIRE_DEVNET
};
const USER_PATH = {
  NEW: "NewAccount",
  EXISTING: "ExistingAccount",
  REHYDRATE: "RehydrateAccount",
  RECOVER: "RecoverAccount"
};
let FactorKeyTypeShareDescription = /*#__PURE__*/function (FactorKeyTypeShareDescription) {
  FactorKeyTypeShareDescription["HashedShare"] = "hashedShare";
  FactorKeyTypeShareDescription["SecurityQuestions"] = "tssSecurityQuestions";
  FactorKeyTypeShareDescription["DeviceShare"] = "deviceShare";
  FactorKeyTypeShareDescription["SeedPhrase"] = "seedPhrase";
  FactorKeyTypeShareDescription["PasswordShare"] = "passwordShare";
  FactorKeyTypeShareDescription["SocialShare"] = "socialShare";
  FactorKeyTypeShareDescription["Other"] = "Other";
  return FactorKeyTypeShareDescription;
}({});
const DELIMITERS = {
  Delimiter1: "\u001c",
  Delimiter2: "\u0015",
  Delimiter3: "\u0016",
  Delimiter4: "\u0017"
};
const ERRORS = {
  TKEY_SHARES_REQUIRED: "required more shares",
  INVALID_BACKUP_SHARE: "invalid backup share"
};
const SOCIAL_FACTOR_INDEX = 1;

/**
 * Defines the TSS Share Index in a simplified way for better implementation.
 **/
let TssShareType = /*#__PURE__*/function (TssShareType) {
  TssShareType[TssShareType["DEVICE"] = 2] = "DEVICE";
  TssShareType[TssShareType["RECOVERY"] = 3] = "RECOVERY";
  return TssShareType;
}({});
const VALID_SHARE_INDICES = [TssShareType.DEVICE, TssShareType.RECOVERY];
const SCALAR_LEN = 32; // Length of secp256k1 scalar in bytes.
const FIELD_ELEMENT_HEX_LEN = 32 * 2; // Length of secp256k1 field element in hex form.
const CURVE = new external_elliptic_namespaceObject.ec("secp256k1");
const MAX_FACTORS = 10; // Maximum number of factors that can be added to an account.
const SOCIAL_TKEY_INDEX = 1;
;// CONCATENATED MODULE: external "@babel/runtime/helpers/defineProperty"
const defineProperty_namespaceObject = require("@babel/runtime/helpers/defineProperty");
var defineProperty_default = /*#__PURE__*/__webpack_require__.n(defineProperty_namespaceObject);
;// CONCATENATED MODULE: external "@tkey-mpc/common-types"
const common_types_namespaceObject = require("@tkey-mpc/common-types");
;// CONCATENATED MODULE: external "@toruslabs/eccrypto"
const eccrypto_namespaceObject = require("@toruslabs/eccrypto");
;// CONCATENATED MODULE: external "@toruslabs/torus.js"
const torus_js_namespaceObject = require("@toruslabs/torus.js");
var torus_js_default = /*#__PURE__*/__webpack_require__.n(torus_js_namespaceObject);
;// CONCATENATED MODULE: external "bn.js"
const external_bn_js_namespaceObject = require("bn.js");
var external_bn_js_default = /*#__PURE__*/__webpack_require__.n(external_bn_js_namespaceObject);
;// CONCATENATED MODULE: ./src/utils.ts





const generateFactorKey = () => {
  const factorKey = new (external_bn_js_default())((0,eccrypto_namespaceObject.generatePrivate)());
  const factorPub = (0,common_types_namespaceObject.getPubKeyPoint)(factorKey);
  return {
    private: factorKey,
    pub: factorPub
  };
};
const generateTSSEndpoints = (tssNodeEndpoints, parties, clientIndex, nodeIndexes) => {
  const endpoints = [];
  const tssWSEndpoints = [];
  const partyIndexes = [];
  const nodeIndexesReturned = [];
  for (let i = 0; i < parties; i++) {
    partyIndexes.push(i);
    if (i === clientIndex) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      endpoints.push(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tssWSEndpoints.push(null);
    } else {
      const targetNodeIndex = nodeIndexes[i] - 1;
      endpoints.push(tssNodeEndpoints[targetNodeIndex]);
      tssWSEndpoints.push(new URL(tssNodeEndpoints[targetNodeIndex]).origin);
      nodeIndexesReturned.push(nodeIndexes[i]);
    }
  }
  return {
    endpoints,
    tssWSEndpoints,
    partyIndexes,
    nodeIndexesReturned
  };
};
function storageAvailable(type) {
  let storage;
  try {
    if (type === "localStorage") storage = window.localStorage;else storage = window.sessionStorage;
    const x = "__storage_test__";
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (error) {
    return false;
  }
}

// TODO think which conversion functions to keep and how to export them.

/**
 * Parses a JWT Token, without verifying the signature.
 * @param token - JWT Token
 * @returns Extracted JSON payload from the token
 */
function parseToken(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace("-", "+").replace("_", "/");
  return JSON.parse(atob(base64 || ""));
}

/**
 * Refreshes TSS shares. Allows to change number of shares. New user shares are
 * only produced for the target indices.
 * @param tKey - Tkey instance to use.
 * @param factorPubs - Factor pub keys after refresh.
 * @param tssIndices - Target tss indices to generate new shares for.
 * @param factorKeyForExistingTSSShare - Factor key for existing TSS share.
 * @param signatures - Signatures for authentication against RSS servers.
 */
async function refreshTssShares(tKey, factorPubs, tssIndices, factorKeyForExistingTSSShare, signatures) {
  let updateMetadata = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;
  const {
    tssShare,
    tssIndex
  } = await tKey.getTSSShare(factorKeyForExistingTSSShare);
  const rssNodeDetails = await tKey._getRssNodeDetails();
  const {
    serverEndpoints,
    serverPubKeys,
    serverThreshold
  } = rssNodeDetails;
  const randomSelectedServers = (0,common_types_namespaceObject.randomSelection)(new Array(rssNodeDetails.serverEndpoints.length).fill(null).map((_, i) => i + 1), Math.ceil(rssNodeDetails.serverEndpoints.length / 2));
  const verifierNameVerifierId = tKey.serviceProvider.getVerifierNameVerifierId();
  await tKey._refreshTSSShares(updateMetadata, tssShare, tssIndex, factorPubs, tssIndices, verifierNameVerifierId, {
    selectedServers: randomSelectedServers,
    serverEndpoints,
    serverPubKeys,
    serverThreshold,
    authSignatures: signatures
  });
}
async function addFactorAndRefresh(tKey, newFactorPub, newFactorTSSIndex, factorKeyForExistingTSSShare, signatures) {
  if (!tKey) {
    throw new Error("tkey does not exist, cannot add factor pub");
  }
  if (VALID_SHARE_INDICES.indexOf(newFactorTSSIndex) === -1) {
    throw new Error(`invalid new share index: must be one of ${VALID_SHARE_INDICES}`);
  }
  if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
    throw new Error(`factorPubs for tssTag = "${tKey.tssTag}" does not exist`);
  }
  const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag];
  const updatedFactorPubs = existingFactorPubs.concat([newFactorPub]);
  const existingTSSIndexes = existingFactorPubs.map(fb => tKey.getFactorEncs(fb).tssIndex);
  const updatedTSSIndexes = existingTSSIndexes.concat([newFactorTSSIndex]);
  await refreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, factorKeyForExistingTSSShare, signatures);
}
async function deleteFactorAndRefresh(tKey, factorPubToDelete, factorKeyForExistingTSSShare, signatures) {
  if (!tKey) {
    throw new Error("tkey does not exist, cannot add factor pub");
  }
  if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
    throw new Error(`factorPubs for tssTag = "${tKey.tssTag}" does not exist`);
  }
  const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag];
  const factorIndex = existingFactorPubs.findIndex(p => p.x.eq(factorPubToDelete.x));
  if (factorIndex === -1) {
    throw new Error(`factorPub ${factorPubToDelete} does not exist`);
  }
  const updatedFactorPubs = existingFactorPubs.slice();
  updatedFactorPubs.splice(factorIndex, 1);
  const updatedTSSIndexes = updatedFactorPubs.map(fb => tKey.getFactorEncs(fb).tssIndex);
  await refreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, factorKeyForExistingTSSShare, signatures);
}
const getHashedPrivateKey = (postboxKey, clientId) => {
  const uid = `${postboxKey}_${clientId}`;
  let hashUid = (0,torus_js_namespaceObject.keccak256)(Buffer.from(uid, "utf8"));
  hashUid = hashUid.replace("0x", "");
  return new (external_bn_js_default())(hashUid, "hex");
};

/**
 * Converts a elliptic curve scalar represented by a BN to a byte buffer in SEC1
 * format (i.e., padded to maximum length).
 * @param s - The scalar of type BN.
 * @returns The SEC1 encoded representation of the scalar.
 */
function scalarBNToBufferSEC1(s) {
  return s.toArrayLike(Buffer, "be", SCALAR_LEN);
}
;// CONCATENATED MODULE: ./src/helper/browserStorage.ts

var _class2;


class MemoryStorage {
  constructor() {
    defineProperty_default()(this, "_store", {});
  }
  getItem(key) {
    return this._store[key] || null;
  }
  setItem(key, value) {
    this._store[key] = value;
  }
  removeItem(key) {
    delete this._store[key];
  }
  clear() {
    this._store = {};
  }
}
class BrowserStorage {
  constructor(storeKey, storage) {
    defineProperty_default()(this, "storage", void 0);
    defineProperty_default()(this, "_storeKey", void 0);
    this.storage = storage;
    this._storeKey = storeKey;
    try {
      if (!storage.getItem(storeKey)) {
        this.resetStore();
      }
    } catch (error) {
      // Storage is not available
    }
  }
  static getInstance(key) {
    let storageKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "local";
    if (!this.instance) {
      let storage;
      if (storageKey === "local" && storageAvailable("localStorage")) {
        storage = localStorage;
      } else if (storageKey === "session" && storageAvailable("sessionStorage")) {
        storage = sessionStorage;
      } else if (storageKey === "memory") {
        storage = new MemoryStorage();
      } else if (typeof storageKey === "object") {
        storage = storageKey;
      }
      if (!storage) {
        throw new Error("No valid storage available");
      }
      this.instance = new this(key, storage);
    }
    return this.instance;
  }
  toJSON() {
    const result = this.storage.getItem(this._storeKey);
    if (!result) throw new Error(`storage ${this._storeKey} is null`);
    return result;
  }
  resetStore() {
    const currStore = this.getStore();
    this.storage.setItem(this._storeKey, JSON.stringify({}));
    return currStore;
  }
  getStore() {
    return JSON.parse(this.storage.getItem(this._storeKey) || "{}");
  }
  get(key) {
    const store = JSON.parse(this.storage.getItem(this._storeKey) || "{}");
    return store[key];
  }
  set(key, value) {
    const store = JSON.parse(this.storage.getItem(this._storeKey) || "{}");
    store[key] = value;
    this.storage.setItem(this._storeKey, JSON.stringify(store));
  }
  remove(key) {
    const store = JSON.parse(this.storage.getItem(this._storeKey) || "{}");
    delete store[key];
    this.storage.setItem(this._storeKey, JSON.stringify(store));
  }
}
_class2 = BrowserStorage;
// eslint-disable-next-line no-use-before-define
defineProperty_default()(BrowserStorage, "instance", void 0);
async function storeWebBrowserFactor(factorKey, mpcCoreKit) {
  let storageKey = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "local";
  const metadata = mpcCoreKit.tKey.getMetadata();
  const currentStorage = BrowserStorage.getInstance("mpc_corekit_store", storageKey);
  const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
  currentStorage.set(tkeyPubX, JSON.stringify({
    factorKey: factorKey.toString("hex").padStart(64, "0")
  }));
}
async function getWebBrowserFactor(mpcCoreKit) {
  let storageKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "local";
  const metadata = mpcCoreKit.tKey.getMetadata();
  const currentStorage = BrowserStorage.getInstance("mpc_corekit_store", storageKey);
  const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
  const tKeyLocalStoreString = currentStorage.get(tkeyPubX);
  const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}");
  return tKeyLocalStore.factorKey;
}
;// CONCATENATED MODULE: external "@tkey-mpc/share-serialization"
const share_serialization_namespaceObject = require("@tkey-mpc/share-serialization");
;// CONCATENATED MODULE: ./src/helper/factorSerialization.ts



/**
 * Converts a mnemonic to a BN.
 * @param shareMnemonic - The mnemonic to convert.
 * @returns A BN respective to your mnemonic
 */
function mnemonicToKey(shareMnemonic) {
  const factorKey = share_serialization_namespaceObject.ShareSerializationModule.deserializeMnemonic(shareMnemonic);
  return factorKey.toString("hex");
}

/**
 * Converts a BN to a mnemonic.
 * @param shareBN - The BN to convert.
 * @returns A mnemonic respective to your BN
 */
function keyToMnemonic(shareHex) {
  const shareBN = new (external_bn_js_default())(shareHex, "hex");
  const mnemonic = share_serialization_namespaceObject.ShareSerializationModule.serializeMnemonic(shareBN);
  return mnemonic;
}
;// CONCATENATED MODULE: external "@babel/runtime/helpers/objectSpread2"
const objectSpread2_namespaceObject = require("@babel/runtime/helpers/objectSpread2");
var objectSpread2_default = /*#__PURE__*/__webpack_require__.n(objectSpread2_namespaceObject);
;// CONCATENATED MODULE: ./src/point.ts




const ZERO_POINT = CURVE.g.mul(new (external_bn_js_default())(0));

/**
 * Class `Point` represents an elliptic curve point over curve `CURVE`.
 */
class Point {
  /**
   * Constructs a new Point from an elliptic point.
   * @param p - The elliptic point to be represented.
   */
  constructor(p) {
    defineProperty_default()(this, "p", void 0);
    this.p = p;
  }

  /**
   * Creates a new Point from a private Key.
   * @param p - The TKey Point.
   * @returns The Point encoded by `p`.
   */
  static fromPrivateKey(privateKey) {
    const ep = CURVE.keyFromPrivate(privateKey.toString("hex")).getPublic();
    return new Point(ep);
  }

  /**
   * Creates a new Point from a TKey Point.
   * @param p - The TKey Point.
   * @returns The Point encoded by `p`.
   */
  static fromTkeyPoint(p) {
    const ep = CURVE.keyFromPublic({
      x: p.x.toString("hex"),
      y: p.y.toString("hex")
    }).getPublic();
    return new Point(ep);
  }

  /**
   * Creates a new Point from an SEC1-encoded byte buffer.
   * @param buf - The SEC1-encoded point.
   * @returns The Point encoded by `buf`.
   */
  static fromBufferSEC1(buf) {
    // "elliptic"@6.5.4 can't decode zero point.
    if (buf.length === 1 && buf[0] === 0) {
      return new Point(ZERO_POINT);
    }
    const p = CURVE.keyFromPublic(buf.toString("hex"), "hex").getPublic();
    return new Point(p);
  }

  /**
   * Converts this point to a TKey Point.
   * @returns A TKey Point representing this point.
   * @throws If this point cannot be represented by a TKey Point. For example,
   * if this point encodes the point at infinity.
   */
  toTkeyPoint() {
    if (this.p.isInfinity()) {
      throw new Error("Point at infinity can't be represented as tkey point.");
    }
    const x = this.p.getX().toString("hex");
    const y = this.p.getY().toString("hex");
    return new common_types_namespaceObject.Point(x, y);
  }

  /**
   * Converts this point to a byte buffer in SEC1 format.
   * @param compressed - Whether to use compressed format.
   * @returns The SEC1-encoded representation of the point.
   */
  toBufferSEC1(compressed) {
    // "elliptic"@6.5.4 can't encode zero point.
    if (this.p.isInfinity()) {
      return Buffer.from("00", "hex");
    }
    return Buffer.from(this.p.encode("hex", compressed), "hex");
  }

  /**
   * Checks for point equality between `this` and `p`.
   * @param p - The point to compare to.
   * @returns True if `this == p`. False otherwise.
   */
  equals(p) {
    return this.p.eq(p.p);
  }
}
;// CONCATENATED MODULE: ./src/helper/securityQuestion.ts







class TssSecurityQuestionStore {
  constructor(shareIndex, factorPublicKey, question) {
    defineProperty_default()(this, "shareIndex", void 0);
    defineProperty_default()(this, "factorPublicKey", void 0);
    defineProperty_default()(this, "question", void 0);
    this.shareIndex = shareIndex;
    this.factorPublicKey = factorPublicKey;
    this.question = question;
  }
  static fromJSON(json) {
    const {
      shareIndex,
      factorPublicKey,
      question
    } = json;
    return new TssSecurityQuestionStore(shareIndex, factorPublicKey, question);
  }
  toJSON() {
    return {
      shareIndex: this.shareIndex,
      factorPublicKey: this.factorPublicKey,
      question: this.question
    };
  }
}
class TssSecurityQuestion {
  constructor() {
    defineProperty_default()(this, "storeDomainName", "tssSecurityQuestion");
  }
  async setSecurityQuestion(params) {
    const {
      mpcCoreKit,
      question,
      answer,
      description
    } = params;
    let {
      shareType
    } = params;
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    if (!question || !answer) {
      throw new Error("question and answer are required");
    }
    const domainKey = `${this.storeDomainName}:${params.mpcCoreKit.tKey.tssTag}`;

    // default using recovery index
    if (!shareType) {
      shareType = TssShareType.RECOVERY;
    } else if (!VALID_SHARE_INDICES.includes(shareType)) {
      throw new Error(`invalid share type: must be one of ${VALID_SHARE_INDICES}`);
    }
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (storeDomain && storeDomain.question) {
      throw new Error("Security question already exists");
    }

    // const pubKey = Point.fromTkeyPoint(mpcCoreKit.tKey.getTSSPub()).toBufferSEC1(true).toString("hex");
    const pubKey = Point.fromTkeyPoint(tkey.getKeyDetails().pubKey).toBufferSEC1(true).toString("hex") + tkey.tssTag;
    let hash = (0,torus_js_namespaceObject.keccak256)(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new (external_bn_js_default())(hash, "hex");
    const descriptionFinal = objectSpread2_default()({
      question
    }, description);
    await mpcCoreKit.createFactor({
      factorKey: factorKeyBN,
      shareType,
      shareDescription: FactorKeyTypeShareDescription.SecurityQuestions,
      additionalMetadata: descriptionFinal
    });
    // set store domain
    const tkeyPt = (0,common_types_namespaceObject.getPubKeyPoint)(factorKeyBN);
    const factorPub = Point.fromTkeyPoint(tkeyPt).toBufferSEC1(true).toString("hex");
    const storeData = new TssSecurityQuestionStore(shareType.toString(), factorPub, question);
    tkey.metadata.setGeneralStoreDomain(domainKey, storeData.toJSON());

    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();
    return factorKeyBN.toString("hex").padStart(64, "0");
  }
  async changeSecurityQuestion(params) {
    const {
      mpcCoreKit,
      newQuestion,
      newAnswer,
      answer
    } = params;
    if (!newQuestion || !newAnswer || !answer) {
      throw new Error("question and answer are required");
    }
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    // const pubKey = Point.fromTkeyPoint(mpcCoreKit.tKey.getTSSPub()).toBufferSEC1(true).toString("hex");
    const pubKey = Point.fromTkeyPoint(tkey.getKeyDetails().pubKey).toBufferSEC1(true).toString("hex") + tkey.tssTag;
    const domainKey = `${this.storeDomainName}:${params.mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    const preHash = answer + pubKey;
    let hash = (0,torus_js_namespaceObject.keccak256)(Buffer.from(preHash, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new (external_bn_js_default())(hash, "hex");
    const factorKeyPt = Point.fromTkeyPoint((0,common_types_namespaceObject.getPubKeyPoint)(factorKeyBN));
    if (factorKeyPt.toBufferSEC1(true).toString("hex") !== store.factorPublicKey) {
      throw new Error("Invalid answer");
    }

    // create new factor key
    const prenewHash = newAnswer + pubKey;
    let newHash = (0,torus_js_namespaceObject.keccak256)(Buffer.from(prenewHash, "utf8"));
    newHash = newHash.startsWith("0x") ? newHash.slice(2) : newHash;
    const newAnswerBN = new (external_bn_js_default())(newHash, "hex");
    const newFactorPt = Point.fromTkeyPoint((0,common_types_namespaceObject.getPubKeyPoint)(newAnswerBN));
    await mpcCoreKit.createFactor({
      factorKey: newAnswerBN,
      shareType: parseInt(store.shareIndex),
      shareDescription: FactorKeyTypeShareDescription.SecurityQuestions
    });

    // update mpcCoreKit state to use new factor key during change password if mpc factor key is security question factor
    if (mpcCoreKit.state.factorKey.eq(factorKeyBN)) {
      await mpcCoreKit.inputFactorKey(newAnswerBN);
    }
    // delete after create factor to prevent last key issue
    // delete old factor key and device share
    await mpcCoreKit.deleteFactor(factorKeyPt.toTkeyPoint(), factorKeyBN);
    store.factorPublicKey = newFactorPt.toBufferSEC1(true).toString("hex");
    store.question = newQuestion;
    tkey.metadata.setGeneralStoreDomain(domainKey, store.toJSON());

    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();
  }

  // Should we check with answer before deleting?
  async deleteSecurityQuestion(mpcCoreKit) {
    let deleteFactorKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const domainKey = `${this.storeDomainName}:${mpcCoreKit.tKey.tssTag}`;
    const tkey = mpcCoreKit.tKey;
    if (deleteFactorKey) {
      const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
      if (!storeDomain || !storeDomain.question) {
        throw new Error("Security question does not exists");
      }
      const store = TssSecurityQuestionStore.fromJSON(storeDomain);
      if (store.factorPublicKey) {
        await mpcCoreKit.deleteFactor(common_types_namespaceObject.Point.fromCompressedPub(store.factorPublicKey));
      }
    }
    tkey.metadata.deleteGeneralStoreDomain(domainKey);
    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();
  }
  async recoverFactor(mpcCoreKit, answer) {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    if (!answer) {
      throw new Error("question and answer are required");
    }
    const tkey = mpcCoreKit.tKey;
    const domainKey = `${this.storeDomainName}:${mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);

    // const pubKey = Point.fromTkeyPoint(mpcCoreKit.tKey.getTSSPub()).toBufferSEC1(true).toString("hex");
    const pubKey = Point.fromTkeyPoint(tkey.getKeyDetails().pubKey).toBufferSEC1(true).toString("hex") + tkey.tssTag;
    let hash = (0,torus_js_namespaceObject.keccak256)(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new (external_bn_js_default())(hash, "hex");
    const factorKeyPt = Point.fromTkeyPoint((0,common_types_namespaceObject.getPubKeyPoint)(factorKeyBN));
    if (factorKeyPt.toBufferSEC1(true).toString("hex") !== store.factorPublicKey) {
      throw new Error("Invalid answer");
    }
    return hash;
  }
  getQuestion(mpcCoreKit) {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const tkey = mpcCoreKit.tKey;
    const domainKey = `${this.storeDomainName}:${mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    return store.question;
  }
}
;// CONCATENATED MODULE: ./src/helper/index.ts



;// CONCATENATED MODULE: ./src/interfaces.ts
let COREKIT_STATUS = /*#__PURE__*/function (COREKIT_STATUS) {
  COREKIT_STATUS["NOT_INITIALIZED"] = "NOT_INITIALIZED";
  COREKIT_STATUS["INITIALIZED"] = "INITIALIZED";
  COREKIT_STATUS["REQUIRED_SHARE"] = "REQUIRED_SHARE";
  COREKIT_STATUS["LOGGED_IN"] = "LOGGED_IN";
  return COREKIT_STATUS;
}({});
;// CONCATENATED MODULE: external "@tkey-mpc/core"
const core_namespaceObject = require("@tkey-mpc/core");
var core_default = /*#__PURE__*/__webpack_require__.n(core_namespaceObject);
;// CONCATENATED MODULE: external "@tkey-mpc/service-provider-torus"
const service_provider_torus_namespaceObject = require("@tkey-mpc/service-provider-torus");
;// CONCATENATED MODULE: external "@tkey-mpc/storage-layer-torus"
const storage_layer_torus_namespaceObject = require("@tkey-mpc/storage-layer-torus");
;// CONCATENATED MODULE: external "@toruslabs/customauth"
const customauth_namespaceObject = require("@toruslabs/customauth");
;// CONCATENATED MODULE: external "@toruslabs/fetch-node-details"
const fetch_node_details_namespaceObject = require("@toruslabs/fetch-node-details");
;// CONCATENATED MODULE: external "@toruslabs/metadata-helpers"
const metadata_helpers_namespaceObject = require("@toruslabs/metadata-helpers");
;// CONCATENATED MODULE: external "@toruslabs/openlogin-session-manager"
const openlogin_session_manager_namespaceObject = require("@toruslabs/openlogin-session-manager");
;// CONCATENATED MODULE: external "@toruslabs/tss-client"
const tss_client_namespaceObject = require("@toruslabs/tss-client");
;// CONCATENATED MODULE: external "@web3auth-mpc/ethereum-provider"
const ethereum_provider_namespaceObject = require("@web3auth-mpc/ethereum-provider");
;// CONCATENATED MODULE: external "bowser"
const external_bowser_namespaceObject = require("bowser");
var external_bowser_default = /*#__PURE__*/__webpack_require__.n(external_bowser_namespaceObject);
;// CONCATENATED MODULE: ./src/mpcCoreKit.ts


/* eslint-disable @typescript-eslint/member-ordering */





















class Web3AuthMPCCoreKit {
  constructor(options) {
    var _window;
    defineProperty_default()(this, "state", {});
    defineProperty_default()(this, "options", void 0);
    defineProperty_default()(this, "privKeyProvider", null);
    defineProperty_default()(this, "torusSp", null);
    defineProperty_default()(this, "storageLayer", null);
    defineProperty_default()(this, "tkey", null);
    defineProperty_default()(this, "sessionManager", void 0);
    defineProperty_default()(this, "currentStorage", void 0);
    defineProperty_default()(this, "nodeDetailManager", void 0);
    defineProperty_default()(this, "_storageBaseKey", "corekit_store");
    defineProperty_default()(this, "enableLogging", false);
    defineProperty_default()(this, "ready", false);
    defineProperty_default()(this, "getTssFactorPub", () => {
      this.checkReady();
      if (!this.state.factorKey) throw new Error("factorKey not present");
      const factorPubsList = this.tKey.metadata.factorPubs[this.tKey.tssTag];
      return factorPubsList.map(factorPub => Point.fromTkeyPoint(factorPub).toBufferSEC1(true).toString("hex"));
    });
    // function for setting up provider
    defineProperty_default()(this, "getPublic", async () => {
      let {
        tssPubKey
      } = this.state;
      if (tssPubKey.length === FIELD_ELEMENT_HEX_LEN + 1) {
        tssPubKey = tssPubKey.subarray(1);
      }
      return tssPubKey;
    });
    defineProperty_default()(this, "sign", async msgHash => {
      // if (this.state.remoteClient) {
      //   return this.remoteSign(msgHash);
      // }
      return this.localSign(msgHash);
    });
    defineProperty_default()(this, "localSign", async msgHash => {
      // PreSetup
      let {
        tssShareIndex,
        tssPubKey
      } = this.state;
      const {
        torusNodeTSSEndpoints
      } = await this.nodeDetailManager.getNodeDetails({
        verifier: "test-verifier",
        verifierId: "test@example.com"
      });
      if (!this.state.factorKey) throw new Error("factorKey not present");
      const {
        tssShare
      } = await this.tKey.getTSSShare(this.state.factorKey);
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
      const {
        nodeIndexes
      } = await this.tKey.serviceProvider.getTSSPubKey(this.tKey.tssTag, this.tKey.metadata.tssNonces[this.tKey.tssTag]);
      const {
        endpoints,
        tssWSEndpoints,
        partyIndexes,
        nodeIndexesReturned: participatingServerDKGIndexes
      } = generateTSSEndpoints(torusNodeTSSEndpoints, parties, clientIndex, nodeIndexes);
      const randomSessionNonce = (0,metadata_helpers_namespaceObject.keccak256)(Buffer.from((0,eccrypto_namespaceObject.generatePrivate)().toString("hex") + Date.now(), "utf8")).toString("hex");
      const tssImportUrl = `${torusNodeTSSEndpoints[0]}/v1/clientWasm`;
      // session is needed for authentication to the web3auth infrastructure holding the factor 1
      const currentSession = `${sessionId}${randomSessionNonce}`;
      let tss;
      if (this.isNodejsOrRN(this.options.uxMode)) {
        tss = this.options.tssLib;
      } else {
        tss = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(__webpack_require__, 796, 23));
        await tss.default(tssImportUrl);
      }
      // setup mock shares, sockets and tss wasm files.
      const [sockets] = await Promise.all([(0,tss_client_namespaceObject.setupSockets)(tssWSEndpoints, randomSessionNonce)]);
      const dklsCoeff = (0,tss_client_namespaceObject.getDKLSCoeff)(true, participatingServerDKGIndexes, tssShareIndex);
      const denormalisedShare = dklsCoeff.mul(tssShare).umod(CURVE.curve.n);
      const share = scalarBNToBufferSEC1(denormalisedShare).toString("base64");
      if (!currentSession) {
        throw new Error(`sessionAuth does not exist ${currentSession}`);
      }
      const signatures = await this.getSigningSignatures(msgHash.toString("hex"));
      if (!signatures) {
        throw new Error(`Signature does not exist ${signatures}`);
      }
      const client = new tss_client_namespaceObject.Client(currentSession, clientIndex, partyIndexes, endpoints, sockets, share, tssPubKey.toString("base64"), true, tssImportUrl);
      const serverCoeffs = {};
      for (let i = 0; i < participatingServerDKGIndexes.length; i++) {
        const serverIndex = participatingServerDKGIndexes[i];
        serverCoeffs[serverIndex] = (0,tss_client_namespaceObject.getDKLSCoeff)(false, participatingServerDKGIndexes, tssShareIndex, serverIndex).toString("hex");
      }
      client.precompute(tss, {
        signatures,
        server_coeffs: serverCoeffs
      });
      await client.ready().catch(err => {
        client.cleanup(tss, {
          signatures,
          server_coeffs: serverCoeffs
        });
        throw err;
      });
      let {
        r,
        s,
        recoveryParam
      } = await client.sign(tss, Buffer.from(msgHash).toString("base64"), true, "", "keccak256", {
        signatures
      });
      if (recoveryParam < 27) {
        recoveryParam += 27;
      }
      // skip await cleanup
      client.cleanup(tss, {
        signatures,
        server_coeffs: serverCoeffs
      });
      return {
        v: recoveryParam,
        r: scalarBNToBufferSEC1(r),
        s: scalarBNToBufferSEC1(s)
      };
    });
    if (!options.chainConfig) options.chainConfig = DEFAULT_CHAIN_CONFIG;
    if (options.chainConfig.chainNamespace !== base_namespaceObject.CHAIN_NAMESPACES.EIP155) {
      throw new Error("You must specify a eip155 chain config.");
    }
    if (!options.web3AuthClientId) {
      throw new Error("You must specify a web3auth clientId.");
    }
    const isNodejsOrRN = this.isNodejsOrRN(options.uxMode);
    if (isNodejsOrRN && ["local", "session"].includes(options.storageKey.toString())) {
      throw new Error(`${options.uxMode} mode do not storage of type : ${options.storageKey}`);
    }
    if (isNodejsOrRN && !options.tssLib) {
      throw new Error(`${options.uxMode} mode requires tssLib`);
    }
    if (options.enableLogging) {
      base_namespaceObject.log.enableAll();
      this.enableLogging = true;
    } else base_namespaceObject.log.setLevel("error");
    if (typeof options.manualSync !== "boolean") options.manualSync = false;
    if (!options.web3AuthNetwork) options.web3AuthNetwork = WEB3AUTH_NETWORK.MAINNET;
    if (!options.storageKey) options.storageKey = "local";
    if (!options.sessionTime) options.sessionTime = 86400;
    if (!options.uxMode) options.uxMode = customauth_namespaceObject.UX_MODE.REDIRECT;
    if (!options.redirectPathName) options.redirectPathName = "redirect";
    if (!options.baseUrl) options.baseUrl = isNodejsOrRN ? "https://localhost" : `${(_window = window) === null || _window === void 0 ? void 0 : _window.location.origin}/serviceworker`;
    if (!options.disableHashedFactorKey) options.disableHashedFactorKey = false;
    if (!options.hashedFactorNonce) options.hashedFactorNonce = options.web3AuthClientId;
    this.options = options;
    this.currentStorage = BrowserStorage.getInstance(this._storageBaseKey, this.options.storageKey);
    const _sessionId = this.currentStorage.get("sessionId");
    this.sessionManager = new openlogin_session_manager_namespaceObject.OpenloginSessionManager({
      sessionTime: this.options.sessionTime,
      sessionId: _sessionId
    });
    this.nodeDetailManager = new fetch_node_details_namespaceObject.NodeDetailManager({
      network: this.options.web3AuthNetwork,
      enableLogging: options.enableLogging
    });
  }
  get tKey() {
    if (this.tkey === null) throw new Error("Tkey not initialized");
    return this.tkey;
  }
  get provider() {
    var _this$privKeyProvider;
    return (_this$privKeyProvider = this.privKeyProvider) !== null && _this$privKeyProvider !== void 0 && _this$privKeyProvider.provider ? this.privKeyProvider.provider : null;
  }
  set provider(_) {
    throw new Error("Not implemented");
  }
  get signatures() {
    var _this$state;
    return (_this$state = this.state) !== null && _this$state !== void 0 && _this$state.signatures ? this.state.signatures : [];
  }
  set signatures(_) {
    throw new Error("Not implemented");
  }

  // this return oauthkey which is used by demo to reset account.
  // this is not the same metadataKey from tkey.
  // will be fixed in next major release
  get metadataKey() {
    var _this$state2;
    return (_this$state2 = this.state) !== null && _this$state2 !== void 0 && _this$state2.oAuthKey ? this.state.oAuthKey : null;
  }
  set metadataKey(_) {
    throw new Error("Not implemented");
  }
  get status() {
    try {
      // metadata will be present if tkey is initialized (1 share)
      // if 2 shares are present, then privKey will be present after metadatakey(tkey) reconstruction
      const {
        tkey
      } = this;
      if (!tkey) return COREKIT_STATUS.NOT_INITIALIZED;
      if (!tkey.metadata) return COREKIT_STATUS.INITIALIZED;
      if (!tkey.privKey || !this.state.factorKey) return COREKIT_STATUS.REQUIRED_SHARE;
      return COREKIT_STATUS.LOGGED_IN;
    } catch (e) {}
    return COREKIT_STATUS.NOT_INITIALIZED;
  }
  get sessionId() {
    return this.sessionManager.sessionId;
  }
  get verifier() {
    var _this$state$userInfo, _this$state3;
    if ((_this$state$userInfo = this.state.userInfo) !== null && _this$state$userInfo !== void 0 && _this$state$userInfo.aggregateVerifier) {
      return this.state.userInfo.aggregateVerifier;
    }
    return (_this$state3 = this.state) !== null && _this$state3 !== void 0 && (_this$state3 = _this$state3.userInfo) !== null && _this$state3 !== void 0 && _this$state3.verifier ? this.state.userInfo.verifier : "";
  }
  get verifierId() {
    var _this$state4;
    return (_this$state4 = this.state) !== null && _this$state4 !== void 0 && (_this$state4 = _this$state4.userInfo) !== null && _this$state4 !== void 0 && _this$state4.verifierId ? this.state.userInfo.verifierId : "";
  }
  get isRedirectMode() {
    return this.options.uxMode === customauth_namespaceObject.UX_MODE.REDIRECT;
  }
  async init() {
    var _window2, _window3;
    let params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
      handleRedirectResult: true
    };
    this.resetState();
    const nodeDetails = await this.nodeDetailManager.getNodeDetails({
      verifier: "test-verifier",
      verifierId: "test@example.com"
    });
    if (!nodeDetails) {
      throw new Error("error getting node details, please try again!");
    }
    this.torusSp = new service_provider_torus_namespaceObject.TorusServiceProvider({
      useTSS: true,
      customAuthArgs: {
        web3AuthClientId: this.options.web3AuthClientId,
        baseUrl: this.options.baseUrl,
        uxMode: this.isNodejsOrRN(this.options.uxMode) ? customauth_namespaceObject.UX_MODE.REDIRECT : this.options.uxMode,
        network: this.options.web3AuthNetwork,
        redirectPathName: this.options.redirectPathName,
        locationReplaceOnRedirect: true
      },
      nodeEndpoints: nodeDetails.torusNodeEndpoints,
      nodePubKeys: nodeDetails.torusNodePub.map(i => ({
        x: i.X,
        y: i.Y
      }))
    });
    this.storageLayer = new storage_layer_torus_namespaceObject.TorusStorageLayer({
      hostUrl: `${new URL(nodeDetails.torusNodeEndpoints[0]).origin}/metadata`,
      enableLogging: this.enableLogging
    });
    const shareSerializationModule = new share_serialization_namespaceObject.ShareSerializationModule();
    this.tkey = new (core_default())({
      enableLogging: this.enableLogging,
      serviceProvider: this.torusSp,
      storageLayer: this.storageLayer,
      manualSync: this.options.manualSync,
      modules: {
        shareSerialization: shareSerializationModule
      }
    });
    if (this.isRedirectMode) {
      await this.tKey.serviceProvider.init({
        skipSw: true,
        skipPrefetch: true
      });
    } else if (this.options.uxMode === customauth_namespaceObject.UX_MODE.POPUP) {
      await this.tKey.serviceProvider.init({});
    }
    this.ready = true;

    // try handle redirect flow if enabled and return(redirect) from oauth login
    if (params.handleRedirectResult && this.options.uxMode === customauth_namespaceObject.UX_MODE.REDIRECT && ((_window2 = window) !== null && _window2 !== void 0 && _window2.location.hash.includes("#state") || (_window3 = window) !== null && _window3 !== void 0 && _window3.location.hash.includes("#access_token"))) {
      await this.handleRedirectResult();

      // if not redirect flow try to rehydrate session if available
    } else if (this.sessionManager.sessionId) {
      await this.rehydrateSession();
      if (this.state.factorKey) await this.setupProvider();
    }
    // if not redirect flow or session rehydration, ask for factor key to login
  }

  async loginWithOauth(params) {
    this.checkReady();
    if (this.isNodejsOrRN(this.options.uxMode)) throw new Error(`Oauth login is NOT supported in ${this.options.uxMode}`);
    const tkeyServiceProvider = this.tKey.serviceProvider;
    try {
      // oAuth login.
      const verifierParams = params;
      const aggregateParams = params;
      if (verifierParams.subVerifierDetails) {
        // single verifier login.
        const loginResponse = await tkeyServiceProvider.triggerLogin(params.subVerifierDetails);
        if (this.isRedirectMode) return;
        this.updateState({
          oAuthKey: this._getOAuthKey(loginResponse),
          userInfo: loginResponse.userInfo,
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData)
        });
      } else if (aggregateParams.subVerifierDetailsArray) {
        const loginResponse = await tkeyServiceProvider.triggerAggregateLogin({
          aggregateVerifierType: aggregateParams.aggregateVerifierType || customauth_namespaceObject.AGGREGATE_VERIFIER.SINGLE_VERIFIER_ID,
          verifierIdentifier: aggregateParams.aggregateVerifierIdentifier,
          subVerifierDetailsArray: aggregateParams.subVerifierDetailsArray
        });
        if (this.isRedirectMode) return;
        this.updateState({
          oAuthKey: this._getOAuthKey(loginResponse),
          userInfo: loginResponse.userInfo[0],
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData)
        });
      }
      await this.setupTkey();
    } catch (err) {
      base_namespaceObject.log.error("login error", err);
      if (err instanceof core_namespaceObject.CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error(err.message);
    }
  }
  async loginWithJWT(idTokenLoginParams) {
    this.checkReady();
    const {
      verifier,
      verifierId,
      idToken
    } = idTokenLoginParams;
    try {
      // oAuth login.
      let loginResponse;
      if (!idTokenLoginParams.subVerifier) {
        // single verifier login.
        loginResponse = await this.tKey.serviceProvider.customAuthInstance.getTorusKey(verifier, verifierId, {
          verifier_id: verifierId
        }, idToken, objectSpread2_default()(objectSpread2_default()({}, idTokenLoginParams.extraVerifierParams), idTokenLoginParams.additionalParams));
        this.tKey.serviceProvider.verifierType = "normal";
      } else {
        // aggregate verifier login
        loginResponse = await this.tKey.serviceProvider.customAuthInstance.getAggregateTorusKey(verifier, verifierId, [{
          verifier: idTokenLoginParams.subVerifier,
          idToken,
          extraVerifierParams: idTokenLoginParams.extraVerifierParams
        }]);
        this.tKey.serviceProvider.verifierType = "aggregate";
      }
      const oAuthShare = this._getOAuthKey(loginResponse);
      this.tKey.serviceProvider.postboxKey = new (external_bn_js_default())(oAuthShare, "hex");
      this.tKey.serviceProvider.verifierName = verifier;
      this.tKey.serviceProvider.verifierId = verifierId;
      this.updateState({
        oAuthKey: oAuthShare,
        userInfo: objectSpread2_default()(objectSpread2_default()({}, parseToken(idToken)), {}, {
          verifier,
          verifierId
        }),
        signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData)
      });
      await this.setupTkey();
    } catch (err) {
      base_namespaceObject.log.error("login error", err);
      if (err instanceof core_namespaceObject.CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error(err.message);
    }
  }
  async handleRedirectResult() {
    this.checkReady();
    try {
      const result = await this.torusSp.customAuthInstance.getRedirectResult();
      if (result.method === customauth_namespaceObject.TORUS_METHOD.TRIGGER_LOGIN) {
        const data = result.result;
        if (!data) throw new Error("Invalid login params passed");
        this.updateState({
          oAuthKey: this._getOAuthKey(data),
          userInfo: data.userInfo,
          signatures: this._getSignatures(data.sessionData.sessionTokenData)
        });
        this.torusSp.verifierType = "normal";
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.verifier;
      } else if (result.method === customauth_namespaceObject.TORUS_METHOD.TRIGGER_AGGREGATE_LOGIN) {
        const data = result.result;
        if (!data) throw new Error("Invalid login params passed");
        this.updateState({
          oAuthKey: this._getOAuthKey(data),
          userInfo: data.userInfo[0],
          signatures: this._getSignatures(data.sessionData.sessionTokenData)
        });
        this.torusSp.verifierType = "aggregate";
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.aggregateVerifier;
      } else {
        throw new Error("Unsupported method type");
      }
      const userInfo = this.getUserInfo();
      if (!this.state.oAuthKey) throw new Error("oAuthKey not present");
      this.torusSp.postboxKey = new (external_bn_js_default())(this.state.oAuthKey, "hex");
      this.torusSp.verifierId = userInfo.verifierId;
      await this.setupTkey();
    } catch (error) {
      base_namespaceObject.log.error("error while handling redirect result", error);
      throw new Error(error.message);
    }
  }
  async inputFactorKey(factorKey) {
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
    } catch (err) {
      base_namespaceObject.log.error("login error", err);
      if (err instanceof core_namespaceObject.CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error(err.message);
    }
  }
  getCurrentFactorKey() {
    this.checkReady();
    if (!this.state.factorKey) throw new Error("factorKey not present");
    if (!this.state.tssShareIndex) throw new Error("TSS Share Type (Index) not present");
    try {
      return {
        factorKey: this.state.factorKey,
        shareType: this.state.tssShareIndex
      };
    } catch (err) {
      base_namespaceObject.log.error("state error", err);
      throw new Error(err.message);
    }
  }
  getTssPublicKey() {
    this.checkReady();
    return this.tKey.getTSSPub();
  }
  async enableMFA(enableMFAParams) {
    let recoveryFactor = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    this.checkReady();
    const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.hashedFactorNonce);
    if (!(await this.checkIfFactorKeyValid(hashedFactorKey))) {
      if (this.tKey._localMetadataTransitions[0].length) throw new Error("CommitChanges are required before enabling MFA");
      throw new Error("MFA already enabled");
    }
    try {
      let browserData;
      if (this.isNodejsOrRN(this.options.uxMode)) {
        browserData = {
          browserName: "Node Env",
          browserVersion: "",
          deviceName: "nodejs"
        };
      } else {
        // try {
        const browserInfo = external_bowser_default().parse(navigator.userAgent);
        const browserName = `${browserInfo.browser.name}`;
        browserData = {
          browserName,
          browserVersion: browserInfo.browser.version,
          deviceName: browserInfo.os.name
        };
      }
      const deviceFactorKey = new (external_bn_js_default())(await this.createFactor({
        shareType: TssShareType.DEVICE,
        additionalMetadata: browserData
      }), "hex");
      storeWebBrowserFactor(deviceFactorKey, this);
      await this.inputFactorKey(new (external_bn_js_default())(deviceFactorKey, "hex"));
      const hashedFactorPub = (0,common_types_namespaceObject.getPubKeyPoint)(hashedFactorKey);
      await this.deleteFactor(hashedFactorPub, hashedFactorKey);
      await this.deleteMetadataShareBackup(hashedFactorKey);

      // only recovery factor = true
      if (recoveryFactor) {
        const backupFactorKey = await this.createFactor(objectSpread2_default()({
          shareType: TssShareType.RECOVERY
        }, enableMFAParams));
        return backupFactorKey;
      }
      // update to undefined for next major release
      return "";
    } catch (err) {
      base_namespaceObject.log.error("error enabling MFA", err);
      throw new Error(err.message);
    }
  }
  async createFactor(createFactorParams) {
    this.checkReady();
    let {
      shareType,
      factorKey,
      shareDescription,
      additionalMetadata
    } = createFactorParams;
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
    const factorPub = (0,common_types_namespaceObject.getPubKeyPoint)(factorKey);
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
      base_namespaceObject.log.error("error creating factor", error);
      throw error;
    }
  }
  async deleteFactor(factorPub, factorKey) {
    if (!this.state.factorKey) throw new Error("Factor key not present");
    if (!this.tKey.metadata.factorPubs) throw new Error("Factor pubs not present");
    const remainingFactors = this.tKey.metadata.factorPubs[this.tKey.tssTag].length || 0;
    if (remainingFactors <= 1) throw new Error("Cannot delete last factor");
    const fpp = Point.fromTkeyPoint(factorPub);
    const stateFpp = Point.fromTkeyPoint((0,common_types_namespaceObject.getPubKeyPoint)(this.state.factorKey));
    if (fpp.equals(stateFpp)) {
      throw new Error("Cannot delete current active factor");
    }
    await deleteFactorAndRefresh(this.tKey, factorPub, this.state.factorKey, this.signatures);
    const factorPubHex = fpp.toBufferSEC1(true).toString("hex");
    const allDesc = this.tKey.metadata.getShareDescription();
    const keyDesc = allDesc[factorPubHex];
    if (keyDesc) {
      keyDesc.forEach(async desc => {
        var _this$tKey;
        await ((_this$tKey = this.tKey) === null || _this$tKey === void 0 ? void 0 : _this$tKey.deleteShareDescription(factorPubHex, desc));
      });
    }

    // delete factorKey share metadata if factorkey is provided
    if (factorKey) {
      const factorKeyBN = new (external_bn_js_default())(factorKey, "hex");
      const derivedFactorPub = Point.fromTkeyPoint((0,common_types_namespaceObject.getPubKeyPoint)(factorKeyBN));
      // only delete if factorPub matches
      if (derivedFactorPub.equals(fpp)) {
        await this.deleteMetadataShareBackup(factorKeyBN);
      }
    }
    if (!this.tKey.manualSync) await this.tKey._syncShareMetadata();
  }
  async logout() {
    if (this.sessionManager.sessionId) {
      // throw new Error("User is not logged in.");
      await this.sessionManager.invalidateSession();
    }
    this.currentStorage.set("sessionId", "");
    this.resetState();
    await this.init({
      handleRedirectResult: false
    });
  }
  getUserInfo() {
    if (!this.state.userInfo) {
      throw new Error("user is not logged in.");
    }
    return this.state.userInfo;
  }
  getKeyDetails() {
    this.checkReady();
    const tkeyDetails = this.tKey.getKeyDetails();
    const tssPubKey = this.state.tssPubKey ? this.tKey.getTSSPub() : undefined;
    const factors = this.tKey.metadata.factorPubs ? this.tKey.metadata.factorPubs[this.tKey.tssTag] : [];
    const keyDetails = {
      // use tkey's for now
      requiredFactors: tkeyDetails.requiredShares,
      threshold: tkeyDetails.threshold,
      totalFactors: factors.length + 1,
      shareDescriptions: this.tKey.getMetadata().getShareDescription(),
      metadataPubKey: tkeyDetails.pubKey,
      tssPubKey
    };
    return keyDetails;
  }
  async commitChanges() {
    this.checkReady();
    if (!this.state.factorKey) throw new Error("factorKey not present");
    try {
      // in case for manualsync = true, _syncShareMetadata will not call syncLocalMetadataTransitions()
      // it will not create a new LocalMetadataTransition
      // manual call syncLocalMetadataTransitions() required to sync local transitions to storage
      await this.tKey._syncShareMetadata();
      await this.tKey.syncLocalMetadataTransitions();
    } catch (error) {
      base_namespaceObject.log.error("sync metadata error", error);
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

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  async importTssKey(tssKey, factorPub) {
    let newTSSIndex = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : TssShareType.DEVICE;
    if (!this.state.signatures) throw new Error("signatures not present");
    const tssKeyBN = new (external_bn_js_default())(tssKey, "hex");
    this.tKey.importTssKey({
      tag: this.tKey.tssTag,
      importKey: tssKeyBN,
      factorPub,
      newTSSIndex
    }, {
      authSignatures: this.state.signatures
    });
  }
  async _UNSAFE_exportTssKey() {
    if (!this.state.factorKey) throw new Error("factorKey not present");
    if (!this.state.signatures) throw new Error("signatures not present");
    const exportTssKey = await this.tKey._UNSAFE_exportTssKey({
      factorKey: this.state.factorKey,
      authSignatures: this.state.signatures,
      selectedServers: []
    });
    return exportTssKey.toString("hex", FIELD_ELEMENT_HEX_LEN);
  }
  getTssNonce() {
    if (!this.tKey.metadata.tssNonces) throw new Error("tssNonce not present");
    const tssNonce = this.tKey.metadata.tssNonces[this.tKey.tssTag];
    return tssNonce;
  }
  async setupTkey() {
    if (!this.state.oAuthKey) {
      throw new Error("user not logged in");
    }
    const existingUser = await this.isMetadataPresent(this.state.oAuthKey);
    if (!existingUser) {
      // Generate or use hash factor and initialize tkey with it.
      let factorKey;
      if (this.options.disableHashedFactorKey) {
        factorKey = generateFactorKey().private;
        // delete previous hashed factorKey if present
        const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.hashedFactorNonce);
        await this.deleteMetadataShareBackup(hashedFactorKey);
      } else {
        factorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.hashedFactorNonce);
      }
      const deviceTSSShare = new (external_bn_js_default())((0,eccrypto_namespaceObject.generatePrivate)());
      const deviceTSSIndex = TssShareType.DEVICE;
      const factorPub = (0,common_types_namespaceObject.getPubKeyPoint)(factorKey);
      await this.tKey.initialize({
        useTSS: true,
        factorPub,
        deviceTSSShare,
        deviceTSSIndex
      });

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
      await this.tKey.initialize({
        neverInitializeNewKey: true
      });
      const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.hashedFactorNonce);
      if ((await this.checkIfFactorKeyValid(hashedFactorKey)) && !this.options.disableHashedFactorKey) {
        // Initialize tkey with existing hashed share if available.
        const factorKeyMetadata = await this.getFactorKeyMetadata(hashedFactorKey);
        await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
        await this.tKey.reconstructKey();
        await this.finalizeTkey(hashedFactorKey);
      }
    }
  }
  async finalizeTkey(factorKey) {
    // Read tss meta data.
    const {
      tssIndex: tssShareIndex
    } = await this.tKey.getTSSShare(factorKey);
    const tssPubKey = Point.fromTkeyPoint(this.tKey.getTSSPub()).toBufferSEC1(false);
    this.updateState({
      tssShareIndex,
      tssPubKey,
      factorKey
    });

    // Finalize setup.
    if (!this.tKey.manualSync) await this.tKey.syncLocalMetadataTransitions();
    await this.setupProvider();
    await this.createSession();
  }
  checkReady() {
    if (!this.ready) {
      throw Error("MPC Core Kit not initialized, call init first!");
    }
  }
  async rehydrateSession() {
    try {
      this.checkReady();
      if (!this.sessionManager.sessionId) return {};
      const result = await this.sessionManager.authorizeSession();
      const factorKey = new (external_bn_js_default())(result.factorKey, "hex");
      if (!factorKey) {
        throw new Error("Invalid factor key");
      }
      this.torusSp.postboxKey = new (external_bn_js_default())(result.oAuthKey, "hex");
      this.torusSp.verifierName = result.userInfo.aggregateVerifier || result.userInfo.verifier;
      this.torusSp.verifierId = result.userInfo.verifierId;
      this.torusSp.verifierType = result.userInfo.aggregateVerifier ? "aggregate" : "normal";
      const factorKeyMetadata = await this.getFactorKeyMetadata(factorKey);
      await this.tKey.initialize({
        neverInitializeNewKey: true
      });
      await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
      await this.tKey.reconstructKey();
      this.updateState({
        factorKey: new (external_bn_js_default())(result.factorKey, "hex"),
        oAuthKey: result.oAuthKey,
        tssShareIndex: result.tssShareIndex,
        tssPubKey: Buffer.from(result.tssPubKey.padStart(FIELD_ELEMENT_HEX_LEN, "0"), "hex"),
        signatures: result.signatures,
        userInfo: result.userInfo
      });
    } catch (err) {
      base_namespaceObject.log.error("error trying to authorize session", err);
    }
  }
  async createSession() {
    try {
      const sessionId = openlogin_session_manager_namespaceObject.OpenloginSessionManager.generateRandomSessionKey();
      this.sessionManager.sessionId = sessionId;
      const {
        oAuthKey,
        factorKey,
        userInfo,
        tssShareIndex,
        tssPubKey
      } = this.state;
      if (!this.state.factorKey) throw new Error("factorKey not present");
      const {
        tssShare
      } = await this.tKey.getTSSShare(this.state.factorKey);
      if (!oAuthKey || !factorKey || !tssShare || !tssPubKey || !userInfo) {
        throw new Error("User not logged in");
      }
      const payload = {
        oAuthKey,
        factorKey: factorKey === null || factorKey === void 0 ? void 0 : factorKey.toString("hex"),
        tssShareIndex: tssShareIndex,
        tssPubKey: Buffer.from(tssPubKey).toString("hex"),
        signatures: this.signatures,
        userInfo
      };
      await this.sessionManager.createSession(payload);
      this.currentStorage.set("sessionId", sessionId);
    } catch (err) {
      base_namespaceObject.log.error("error creating session", err);
    }
  }
  async isMetadataPresent(privateKey) {
    var _this$tKey2;
    const privateKeyBN = new (external_bn_js_default())(privateKey, "hex");
    const metadata = await ((_this$tKey2 = this.tKey) === null || _this$tKey2 === void 0 ? void 0 : _this$tKey2.storageLayer.getMetadata({
      privKey: privateKeyBN
    }));
    if (metadata && Object.keys(metadata).length > 0 && metadata.message !== "KEY_NOT_FOUND") {
      return true;
    }
    return false;
  }
  async checkIfFactorKeyValid(factorKey) {
    var _this$tKey3;
    this.checkReady();
    const factorKeyMetadata = await ((_this$tKey3 = this.tKey) === null || _this$tKey3 === void 0 ? void 0 : _this$tKey3.storageLayer.getMetadata({
      privKey: factorKey
    }));
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND" || factorKeyMetadata.message === "SHARE_DELETED") {
      return false;
    }
    base_namespaceObject.log.info("factorKeyMetadata", factorKeyMetadata);
    return true;
  }
  async getFactorKeyMetadata(factorKey) {
    var _this$tKey4;
    this.checkReady();
    const factorKeyMetadata = await ((_this$tKey4 = this.tKey) === null || _this$tKey4 === void 0 ? void 0 : _this$tKey4.storageLayer.getMetadata({
      privKey: factorKey
    }));
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND") {
      throw new Error("no metadata for your factor key, reset your account");
    }
    return common_types_namespaceObject.ShareStore.fromJSON(factorKeyMetadata);
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
      const {
        tssIndex
      } = await this.tKey.getTSSShare(this.state.factorKey);
      this.updateState({
        tssShareIndex: tssIndex
      });
      return;
    }
    if (!this.state.factorKey) throw new Error("factorKey not present");
    const {
      tssShare
    } = await this.tKey.getTSSShare(this.state.factorKey);
    const updatedFactorPubs = this.tKey.metadata.factorPubs[this.tKey.tssTag].concat([newFactorPub]);
    const factorEncs = JSON.parse(JSON.stringify(this.tKey.metadata.factorEncs[this.tKey.tssTag]));
    const factorPubID = newFactorPub.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    factorEncs[factorPubID] = {
      tssIndex: this.state.tssShareIndex,
      type: "direct",
      userEnc: await (0,common_types_namespaceObject.encrypt)(Point.fromTkeyPoint(newFactorPub).toBufferSEC1(false), scalarBNToBufferSEC1(tssShare)),
      serverEncs: []
    };
    this.tKey.metadata.addTSSData({
      tssTag: this.tKey.tssTag,
      factorPubs: updatedFactorPubs,
      factorEncs
    });
    if (!this.tKey.manualSync) await this.tKey._syncShareMetadata();
  }
  async getMetadataShare() {
    try {
      var _this$tKey5, _this$tKey6;
      const polyId = (_this$tKey5 = this.tKey) === null || _this$tKey5 === void 0 ? void 0 : _this$tKey5.metadata.getLatestPublicPolynomial().getPolynomialID();
      const shares = (_this$tKey6 = this.tKey) === null || _this$tKey6 === void 0 ? void 0 : _this$tKey6.shares[polyId];
      let share = null;
      for (const shareIndex in shares) {
        if (shareIndex !== SOCIAL_TKEY_INDEX.toString()) {
          share = shares[shareIndex];
        }
      }
      if (!share) throw new Error("no metadata share found");
      return share;
    } catch (err) {
      base_namespaceObject.log.error("create device share error", err);
      throw new Error(err.message);
    }
  }
  async deleteMetadataShareBackup(factorKey) {
    var _this$tkey, _this$tkey2;
    await this.tKey.addLocalMetadataTransitions({
      input: [{
        message: common_types_namespaceObject.SHARE_DELETED,
        dateAdded: Date.now()
      }],
      privKey: [factorKey]
    });
    if (!((_this$tkey = this.tkey) !== null && _this$tkey !== void 0 && _this$tkey.manualSync)) await ((_this$tkey2 = this.tkey) === null || _this$tkey2 === void 0 ? void 0 : _this$tkey2.syncLocalMetadataTransitions());
  }
  async backupMetadataShare(factorKey) {
    var _this$tKey7, _this$tkey3, _this$tkey4;
    const metadataShare = await this.getMetadataShare();

    // Set metadata for factor key backup
    await ((_this$tKey7 = this.tKey) === null || _this$tKey7 === void 0 ? void 0 : _this$tKey7.addLocalMetadataTransitions({
      input: [metadataShare],
      privKey: [factorKey]
    }));
    if (!((_this$tkey3 = this.tkey) !== null && _this$tkey3 !== void 0 && _this$tkey3.manualSync)) await ((_this$tkey4 = this.tkey) === null || _this$tkey4 === void 0 ? void 0 : _this$tkey4.syncLocalMetadataTransitions());
  }
  async addFactorDescription(factorKey, shareDescription) {
    var _this$tKey8;
    let additionalMetadata = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    let updateMetadata = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    const {
      tssIndex
    } = await this.tKey.getTSSShare(factorKey);
    const tkeyPoint = (0,common_types_namespaceObject.getPubKeyPoint)(factorKey);
    const factorPub = Point.fromTkeyPoint(tkeyPoint).toBufferSEC1(true).toString("hex");
    const params = objectSpread2_default()(objectSpread2_default()({
      module: shareDescription,
      dateAdded: Date.now()
    }, additionalMetadata), {}, {
      tssShareIndex: tssIndex
    });
    await ((_this$tKey8 = this.tKey) === null || _this$tKey8 === void 0 ? void 0 : _this$tKey8.addShareDescription(factorPub, JSON.stringify(params), updateMetadata));
  }
  async setupProvider() {
    const signingProvider = new ethereum_provider_namespaceObject.EthereumSigningProvider({
      config: {
        chainConfig: this.options.chainConfig
      }
    });
    await signingProvider.setupProvider({
      sign: this.sign,
      getPublic: this.getPublic
    });
    this.privKeyProvider = signingProvider;
  }
  updateState(newState) {
    this.state = objectSpread2_default()(objectSpread2_default()({}, this.state), newState);
  }
  resetState() {
    this.tkey = null;
    this.privKeyProvider = null;
  }
  _getOAuthKey(result) {
    return torus_js_default().getPostboxKey(result);
  }
  _getSignatures(sessionData) {
    return sessionData.map(session => JSON.stringify({
      data: session.token,
      sig: session.signature
    }));
  }
  async getSigningSignatures(data) {
    if (!this.signatures) throw new Error("signatures not present");
    base_namespaceObject.log.info("data", data);
    return this.signatures;
  }
  isNodejsOrRN(params) {
    const mode = params;
    return mode === "nodejs" || mode === "react-native";
  }
}
;// CONCATENATED MODULE: ./src/index.ts






})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=mpcCoreKit.cjs.js.map