import { TORUS_SAPPHIRE_NETWORK, KEY_TYPE, SIGNER_MAP } from '@toruslabs/constants';
import _defineProperty from '@babel/runtime/helpers/defineProperty';
import { ShareSerializationModule } from '@tkey/share-serialization';
import BN from 'bn.js';
import _objectSpread from '@babel/runtime/helpers/objectSpread2';
import { secp256k1, Point, KeyType, ShareStore, SHARE_DELETED } from '@tkey/common-types';
import { getPubKeyPoint, factorKeyCurve, lagrangeInterpolation, TSSTorusServiceProvider, TKeyTSS } from '@tkey/tss';
export { factorKeyCurve } from '@tkey/tss';
import { keccak256, Torus } from '@toruslabs/torus.js';
import { generatePrivateBN, CoreError } from '@tkey/core';
import { TorusStorageLayer } from '@tkey/storage-layer-torus';
import { UX_MODE, AGGREGATE_VERIFIER, TORUS_METHOD } from '@toruslabs/customauth';
import { Ed25519Curve } from '@toruslabs/elliptic-wrapper';
import { fetchLocalConfig } from '@toruslabs/fnd-base';
import { keccak256 as keccak256$1 } from '@toruslabs/metadata-helpers';
import { SessionManager } from '@toruslabs/session-manager';
import { setupSockets, getDKLSCoeff, Client } from '@toruslabs/tss-client';
import { sign } from '@toruslabs/tss-frost-client';
import bowser from 'bowser';
import { eddsa, ec } from 'elliptic';
import { safeatob } from '@toruslabs/openlogin-utils';
import loglevel from 'loglevel';

const WEB3AUTH_NETWORK = {
  MAINNET: TORUS_SAPPHIRE_NETWORK.SAPPHIRE_MAINNET,
  DEVNET: TORUS_SAPPHIRE_NETWORK.SAPPHIRE_DEVNET
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

const MAX_FACTORS = 10; // Maximum number of factors that can be added to an account.
const SOCIAL_TKEY_INDEX = 1;

/**
 * Fix the prototype chain of the error
 *
 * Use Object.setPrototypeOf
 * Support ES6 environments
 *
 * Fallback setting __proto__
 * Support IE11+, see https://docs.microsoft.com/en-us/scripting/javascript/reference/javascript-version-information
 */
function fixProto(target, prototype) {
  const {
    setPrototypeOf
  } = Object;
  if (setPrototypeOf) {
    setPrototypeOf(target, prototype);
  } else {
    // eslint-disable-next-line no-proto, @typescript-eslint/no-explicit-any
    target.__proto__ = prototype;
  }
}

/**
 * Capture and fix the error stack when available
 *
 * Use Error.captureStackTrace
 * Support v8 environments
 */
function fixStack(target, fn = target.constructor) {
  const {
    captureStackTrace
  } = Error;
  if (captureStackTrace) {
    captureStackTrace(target, fn);
  }
}

// copy from https://github.com/microsoft/TypeScript/blob/main/lib/lib.es2022.error.d.ts
// avoid typescript isue https://github.com/adriengibrat/ts-custom-error/issues/81

/**
 * Allows to easily extend a base class to create custom applicative errors.
 *
 * example:
 * ```
 * class HttpError extends CustomError {
 * 	public constructor(
 * 		public code: number,
 * 		message?: string,
 *      cause?: Error,
 * 	) {
 * 		super(message, { cause })
 * 	}
 * }
 *
 * new HttpError(404, 'Not found')
 * ```
 */
class CustomError extends Error {
  constructor(message, options) {
    super(message, options);
    // set error name as constructor name, make it not enumerable to keep native Error behavior
    // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target#new.target_in_constructors
    // see https://github.com/adriengibrat/ts-custom-error/issues/30
    _defineProperty(this, "name", void 0);
    Object.defineProperty(this, "name", {
      value: new.target.name,
      enumerable: false,
      configurable: true
    });
    // fix the extended error prototype chain
    // because typescript __extends implementation can't
    // see https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
    fixProto(this, new.target.prototype);
    // try to remove contructor from stack trace
    fixStack(this);
  }
}
class AbstractCoreKitError extends CustomError {
  constructor(code, message) {
    // takes care of stack and proto
    super(message);
    _defineProperty(this, "code", void 0);
    _defineProperty(this, "message", void 0);
    this.code = code;
    this.message = message || "";
    // Set name explicitly as minification can mangle class names
    Object.defineProperty(this, "name", {
      value: "TkeyError"
    });
  }
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message
    };
  }
  toString() {
    return JSON.stringify(this.toJSON());
  }
}

/**
 * CoreKitError, extension for Error using CustomError
 *
 * Usage:
 * 1. throw CoreKitError.factorKeyNotPresent("Required factor key missing in the operation."); // Use a predefined method to throw a common error
 * 2. throw CoreKitError.fromCode(1001); // Throw an error using a code for a common error
 * 3. throw new CoreKitError(1102, "'tkey' instance has not been initialized."); // Throw a specific error with a custom message
 *
 * Guide:
 * 1000 - Configuration errors
 * 1100 - TSS and key management errors
 * 1200 - Factor key and authentication errors
 * 1300 - Initialization and session management
 */
class CoreKitError extends AbstractCoreKitError {
  constructor(code, message) {
    super(code, message);
    Object.defineProperty(this, "name", {
      value: "CoreKitError"
    });
  }
  static fromCode(code, extraMessage = "") {
    return new CoreKitError(code, `${CoreKitError.messages[code]} ${extraMessage}`);
  }
  static default(extraMessage = "") {
    return new CoreKitError(1000, `${CoreKitError.messages[1000]} ${extraMessage}`);
  }

  // Configuration errors
  static chainConfigInvalid(extraMessage = "") {
    return CoreKitError.fromCode(1001, extraMessage);
  }
  static clientIdInvalid(extraMessage = "") {
    return CoreKitError.fromCode(1002, extraMessage);
  }
  static storageTypeUnsupported(extraMessage = "") {
    return CoreKitError.fromCode(1003, extraMessage);
  }
  static oauthLoginUnsupported(extraMessage = "") {
    return CoreKitError.fromCode(1004, extraMessage);
  }
  static noValidStorageOptionFound(extraMessage = "") {
    return CoreKitError.fromCode(1005, extraMessage);
  }
  static noDataFoundInStorage(extraMessage = "") {
    return CoreKitError.fromCode(1006, extraMessage);
  }
  static invalidConfig(extraMessage = "") {
    return CoreKitError.fromCode(1007, extraMessage);
  }

  // TSS and key management errors
  static tssLibRequired(extraMessage = "") {
    return CoreKitError.fromCode(1101, extraMessage);
  }
  static tkeyInstanceUninitialized(extraMessage = "") {
    return CoreKitError.fromCode(1102, extraMessage);
  }
  static duplicateTssIndex(extraMessage = "") {
    return CoreKitError.fromCode(1103, extraMessage);
  }
  static nodeDetailsRetrievalFailed(extraMessage = "") {
    return CoreKitError.fromCode(1104, extraMessage);
  }
  static prefetchValueExceeded(extraMessage = "") {
    return CoreKitError.fromCode(1105, extraMessage);
  }
  static invalidTorusLoginResponse(extraMessage = "") {
    return CoreKitError.fromCode(1106, extraMessage);
  }
  static invalidTorusAggregateLoginResponse(extraMessage = "") {
    return CoreKitError.fromCode(1107, extraMessage);
  }
  static unsupportedRedirectMethod(extraMessage = "") {
    return CoreKitError.fromCode(1108, extraMessage);
  }
  static postBoxKeyMissing(extraMessage = "") {
    return CoreKitError.fromCode(1109, extraMessage);
  }
  static tssShareTypeIndexMissing(extraMessage = "") {
    return CoreKitError.fromCode(1110, extraMessage);
  }
  static tssPublicKeyOrEndpointsMissing(extraMessage = "") {
    return CoreKitError.fromCode(1111, extraMessage);
  }
  static activeSessionNotFound(extraMessage = "") {
    return CoreKitError.fromCode(1112, extraMessage);
  }
  static tssNoncesMissing(extraMessage = "") {
    return CoreKitError.fromCode(1113, extraMessage);
  }
  static tssKeyImportNotAllowed(extraMessage = "") {
    return CoreKitError.fromCode(1114, extraMessage);
  }

  // Factor key and authentication errors
  static factorKeyNotPresent(extraMessage = "") {
    return CoreKitError.fromCode(1201, extraMessage);
  }
  static factorKeyAlreadyExists(extraMessage = "") {
    return CoreKitError.fromCode(1202, extraMessage);
  }
  static mfaAlreadyEnabled(extraMessage = "") {
    return CoreKitError.fromCode(1203, extraMessage);
  }
  static cannotDeleteLastFactor(extraMessage = "") {
    return CoreKitError.fromCode(1204, extraMessage);
  }
  static factorInUseCannotBeDeleted(extraMessage = "") {
    return CoreKitError.fromCode(1205, extraMessage);
  }
  static userNotLoggedIn(extraMessage = "") {
    return CoreKitError.fromCode(1206, extraMessage);
  }
  static providedFactorKeyInvalid(extraMessage = "") {
    return CoreKitError.fromCode(1207, extraMessage);
  }
  static factorEncsMissing(extraMessage = "") {
    return CoreKitError.fromCode(1208, extraMessage);
  }
  static noMetadataFound(extraMessage = "") {
    return CoreKitError.fromCode(1209, extraMessage);
  }
  static newShareIndexInvalid(extraMessage = "") {
    return CoreKitError.fromCode(1210, extraMessage);
  }
  static maximumFactorsReached(extraMessage = "") {
    return CoreKitError.fromCode(1211, extraMessage);
  }
  static noMetadataShareFound(extraMessage = "") {
    return CoreKitError.fromCode(1212, extraMessage);
  }
  static signaturesNotPresent(extraMessage = "") {
    return CoreKitError.fromCode(1213, extraMessage);
  }
  static factorPubsMissing(extraMessage = "") {
    return CoreKitError.fromCode(1214, extraMessage);
  }

  // Initialization and session management
  static commitChangesBeforeMFA(extraMessage = "") {
    return CoreKitError.fromCode(1301, extraMessage);
  }
  static mpcCoreKitNotInitialized(extraMessage = "") {
    return CoreKitError.fromCode(1302, extraMessage);
  }
}
_defineProperty(CoreKitError, "messages", {
  // Configuration errors
  1001: "You must specify a valid eip155 chain configuration in the options.",
  1002: "You must specify a web3auth clientId.",
  1003: "Unsupported storage type in this UX mode.",
  1004: "OAuth login is NOT supported in this UX mode.",
  1005: "No valid storage option found.",
  1006: "No data found in storage.",
  1007: "Invalid config.",
  // TSS and key management errors
  1101: "'tssLib' is required when running in this UX mode.",
  1102: "'tkey' instance has not been initialized.",
  1103: "Duplicate TSS index found. Ensure that each TSS index is unique.",
  1104: "Failed to retrieve node details. Please check your network connection and try again.",
  1105: "The prefetch TSS public keys exceeds the maximum allowed limit of 3.",
  1106: "Invalid 'TorusLoginResponse' data provided.",
  1107: "Invalid 'TorusAggregateLoginResponse' data provided.",
  1108: "Unsupported method type encountered in redirect result.",
  1109: "OAuthKey not present in state.",
  1110: "TSS Share Type (Index) not present in state when getting current factor key.",
  1111: "'tssPubKey' or 'torusNodeTSSEndpoints' are missing.",
  1112: "No active session found.",
  1113: "tssNonces not present in metadata when getting tss nonce.",
  1114: "A TSS key cannot be imported for an existing user who already has a key configured.",
  // Factor key and authentication errors
  1201: "factorKey not present in state when required.",
  1202: "A factor with the same key already exists.",
  1203: "MFA is already enabled.",
  1204: "Cannot delete the last remaining factor as at least one factor is required.",
  1205: "The factor currently in use cannot be deleted.",
  1206: "User is not logged in.",
  1207: "Provided factor key is invalid.",
  1208: "'factorEncs' mpt [resemt].",
  1209: "No metadata found for the provided factor key. Consider resetting your account if this error persists.",
  1210: "The new share index is not valid. It must be one of the valid share indices.",
  1211: "The maximum number of allowable factors (10) has been reached.",
  1212: "No metadata share found in the current polynomial.",
  1213: "No signatures found.",
  1214: "Factor public keys not present",
  // Initialization and session management
  1301: "The 'CommitChanges' method must be called before enabling MFA.",
  1302: "The MPC Core Kit is not initialized. Please ensure you call the 'init()' method to initialize the kit properly before attempting any operations."
});

class MemoryStorage {
  constructor() {
    _defineProperty(this, "_store", {});
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
class AsyncStorage {
  constructor(storeKey, storage) {
    _defineProperty(this, "storage", void 0);
    _defineProperty(this, "_storeKey", void 0);
    this.storage = storage;
    this._storeKey = storeKey;
  }
  async toJSON() {
    const result = await this.storage.getItem(this._storeKey);
    if (!result) {
      throw CoreKitError.noDataFoundInStorage(`No data found in storage under key '${this._storeKey}'.`);
    }
    return result;
  }
  async resetStore() {
    const currStore = await this.getStore();
    await this.storage.setItem(this._storeKey, JSON.stringify({}));
    return currStore;
  }
  async getStore() {
    return JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
  }
  async get(key) {
    const store = JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
    return store[key];
  }
  async set(key, value) {
    const store = JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
    store[key] = value;
    await this.storage.setItem(this._storeKey, JSON.stringify(store));
  }
  async remove(key) {
    const store = JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
    delete store[key];
    await this.storage.setItem(this._storeKey, JSON.stringify(store));
  }
}

/**
 * Converts a mnemonic to a BN.
 * @param shareMnemonic - The mnemonic to convert.
 * @returns A BN respective to your mnemonic
 */
function mnemonicToKey(shareMnemonic) {
  const factorKey = ShareSerializationModule.deserializeMnemonic(shareMnemonic);
  return factorKey.toString("hex");
}

/**
 * Converts a BN to a mnemonic.
 * @param shareBN - The BN to convert.
 * @returns A mnemonic respective to your BN
 */
function keyToMnemonic(shareHex) {
  const shareBN = new BN(shareHex, "hex");
  const mnemonic = ShareSerializationModule.serializeMnemonic(shareBN);
  return mnemonic;
}

class TssSecurityQuestionStore {
  constructor(shareIndex, factorPublicKey, question) {
    _defineProperty(this, "shareIndex", void 0);
    _defineProperty(this, "factorPublicKey", void 0);
    _defineProperty(this, "question", void 0);
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
    _defineProperty(this, "storeDomainName", "tssSecurityQuestion");
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
    const pubKey = tkey.getKeyDetails().pubKey.toSEC1(secp256k1, true).toString("hex") + tkey.tssTag;
    let hash = keccak256(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const descriptionFinal = _objectSpread({
      question
    }, description);
    await mpcCoreKit.createFactor({
      factorKey: factorKeyBN,
      shareType,
      shareDescription: FactorKeyTypeShareDescription.SecurityQuestions,
      additionalMetadata: descriptionFinal
    });
    // set store domain
    const tkeyPt = getPubKeyPoint(factorKeyBN, factorKeyCurve);
    const factorPub = tkeyPt.toSEC1(factorKeyCurve, true).toString("hex");
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
    const pubKey = tkey.getKeyDetails().pubKey.toSEC1(secp256k1, true).toString("hex") + tkey.tssTag;
    const domainKey = `${this.storeDomainName}:${params.mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    const preHash = answer + pubKey;
    let hash = keccak256(Buffer.from(preHash, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const factorKeyPt = getPubKeyPoint(factorKeyBN, factorKeyCurve);
    if (factorKeyPt.toSEC1(factorKeyCurve, true).toString("hex") !== store.factorPublicKey) {
      throw new Error("Invalid answer");
    }

    // create new factor key
    const prenewHash = newAnswer + pubKey;
    let newHash = keccak256(Buffer.from(prenewHash, "utf8"));
    newHash = newHash.startsWith("0x") ? newHash.slice(2) : newHash;
    const newAnswerBN = new BN(newHash, "hex");
    const newFactorPt = Point.fromScalar(newAnswerBN, factorKeyCurve);
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
    await mpcCoreKit.deleteFactor(factorKeyPt, factorKeyBN);
    store.factorPublicKey = newFactorPt.toSEC1(factorKeyCurve, true).toString("hex");
    store.question = newQuestion;
    tkey.metadata.setGeneralStoreDomain(domainKey, store.toJSON());

    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();
  }

  // Should we check with answer before deleting?
  async deleteSecurityQuestion(mpcCoreKit, deleteFactorKey = true) {
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
        await mpcCoreKit.deleteFactor(Point.fromSEC1(factorKeyCurve, store.factorPublicKey));
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
    const pubKey = tkey.getKeyDetails().pubKey.toSEC1(secp256k1, true).toString("hex") + tkey.tssTag;
    let hash = keccak256(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const factorKeyPt = Point.fromScalar(factorKeyBN, factorKeyCurve);
    if (factorKeyPt.toSEC1(factorKeyCurve, true).toString("hex") !== store.factorPublicKey) {
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

// TODO: move the types to a base class for both dkls and frost in future

let COREKIT_STATUS = /*#__PURE__*/function (COREKIT_STATUS) {
  COREKIT_STATUS["NOT_INITIALIZED"] = "NOT_INITIALIZED";
  COREKIT_STATUS["INITIALIZED"] = "INITIALIZED";
  COREKIT_STATUS["REQUIRED_SHARE"] = "REQUIRED_SHARE";
  COREKIT_STATUS["LOGGED_IN"] = "LOGGED_IN";
  return COREKIT_STATUS;
}({});

const ed25519 = () => {
  return new eddsa("ed25519");
};

/**
 * Secure PRNG. Uses `crypto.getRandomValues`, which defers to OS.
 */
function randomBytes(bytesLength = 32) {
  // We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
  const crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : undefined;
  if (crypto && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}
function generateEd25519Seed() {
  return Buffer.from(randomBytes(32));
}
const generateFactorKey = () => {
  const keyPair = factorKeyCurve.genKeyPair();
  const pub = Point.fromElliptic(keyPair.getPublic());
  return {
    private: keyPair.getPrivate(),
    pub
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
async function storageAvailable(storage) {
  try {
    const x = "__storage_test__";
    const rand = Math.random().toString();
    await storage.setItem(x, rand);
    const value = await storage.getItem(rand);
    if (value !== rand) {
      throw new Error("Value mismatch");
    }
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
  const payload = token.split(".")[1];
  return JSON.parse(safeatob(payload));
}
const getHashedPrivateKey = (postboxKey, clientId) => {
  const uid = `${postboxKey}_${clientId}`;
  let hashUid = keccak256(Buffer.from(uid, "utf8"));
  hashUid = hashUid.replace("0x", "");
  return new BN(hashUid, "hex");
};

/**
 * Converts an elliptic curve scalar represented by a BN to a byte buffer in SEC1
 * format (i.e., padded to maximum length).
 * @param s - The scalar of type BN.
 * @returns The SEC1 encoded representation of the scalar.
 */
function scalarBNToBufferSEC1(s) {
  return s.toArrayLike(Buffer, "be", SCALAR_LEN);
}
function sampleEndpoints(endpoints, n) {
  if (n > endpoints.length) {
    throw new Error("Invalid number of endpoints");
  }
  const shuffledEndpoints = endpoints.slice().sort(() => Math.random() - 0.5);
  return shuffledEndpoints.slice(0, n).sort((a, b) => a.index - b.index);
}
function fraction(curve, nom, denom) {
  return nom.mul(denom.invm(curve.n)).umod(curve.n);
}
function lagrangeCoefficient(curve, xCoords, targetCoeff, targetX) {
  return xCoords.filter((_, i) => i !== targetCoeff).reduce((prev, cur) => {
    const frac = fraction(curve, targetX.sub(cur), xCoords[targetCoeff].sub(cur));
    return prev.mul(frac).umod(curve.n);
  }, new BN(1));
}
function lagrangeCoefficients(curve, xCoords, targetX) {
  const xCoordsBN = xCoords.map(i => new BN(i));
  const targetXBN = new BN(targetX);
  return xCoordsBN.map((_value, i) => lagrangeCoefficient(curve, xCoordsBN, i, targetXBN));
}
const SERVER_XCOORD_L1 = 1;
const CLIENT_XCOORD_L1 = 2;

/**
 * Derive share coefficients for client and servers.
 *
 * @param curve - The curve to be used.
 * @param serverXCoords - The source and target x-coordinates of the selected
 * servers.
 * @param targetClientXCoord - The target x-coordinate of the client.
 * @param sourceClientXCoord - The source x-coordinate of the client in the L1
 * hierarchy.
 * @returns - The share coefficients for the client and the servers.
 */
function deriveShareCoefficients(ec, serverXCoords, targetClientXCoord, sourceClientXCoord = CLIENT_XCOORD_L1) {
  const l1Coefficients = lagrangeCoefficients(ec, [SERVER_XCOORD_L1, sourceClientXCoord], 0);
  const l2Coefficients = lagrangeCoefficients(ec, serverXCoords, 0);
  if (serverXCoords.includes(targetClientXCoord)) {
    throw new Error(`Invalid server x-coordinates: overlapping with client x-coordinate: ${serverXCoords} ${targetClientXCoord}`);
  }
  const targetCoefficients = lagrangeCoefficients(ec, [targetClientXCoord, ...serverXCoords], 0);

  // Derive server coefficients.
  const serverCoefficients = l2Coefficients.map((coeff, i) => fraction(ec, l1Coefficients[0].mul(coeff), targetCoefficients[i + 1]));

  // Derive client coefficient.
  const clientCoefficient = fraction(ec, l1Coefficients[1], targetCoefficients[0]);
  return {
    serverCoefficients,
    clientCoefficient
  };
}
function generateSessionNonce() {
  return keccak256(Buffer.from(generatePrivateBN().toString("hex") + Date.now(), "utf8"));
}
function getSessionId(verifier, verifierId, tssTag, tssNonce, sessionNonce) {
  return `${verifier}${DELIMITERS.Delimiter1}${verifierId}${DELIMITERS.Delimiter2}${tssTag}${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}${sessionNonce}`;
}
function sigToRSV(sig) {
  if (sig.length !== 65) {
    throw new Error(`Invalid signature length: expected 65, got ${sig.length}`);
  }
  return {
    r: sig.subarray(0, 32),
    s: sig.subarray(32, 64),
    v: sig[64]
  };
}
function makeEthereumSigner(kit) {
  if (kit.keyType !== KeyType.secp256k1) {
    throw new Error(`Invalid key type: expected secp256k1, got ${kit.keyType}`);
  }
  return {
    sign: async msgHash => {
      const sig = await kit.sign(msgHash, true);
      return sigToRSV(sig);
    },
    getPublic: async () => {
      const pk = Point.fromSEC1(secp256k1, kit.getPubKey().toString("hex"));
      return pk.toSEC1(secp256k1).subarray(1);
    }
  };
}
const log = loglevel.getLogger("mpc-core-kit");
log.disableAll();

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
        throw CoreKitError.factorKeyNotPresent("factorKey not present in state when getting tss factor public key.");
      }
      const factorPubsList = this.tKey.metadata.factorPubs[this.tKey.tssTag];
      return factorPubsList.map(factorPub => factorPub.toSEC1(factorKeyCurve, true).toString("hex"));
    });
    if (!options.web3AuthClientId) {
      throw CoreKitError.clientIdInvalid();
    }
    this._tssLib = options.tssLib;
    this._keyType = options.tssLib.keyType;
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
    if (!options.baseUrl) options.baseUrl = isNodejsOrRN ? "https://localhost" : `${(_window = window) === null || _window === void 0 ? void 0 : _window.location.origin}/serviceworker`;
    if (!options.disableHashedFactorKey) options.disableHashedFactorKey = false;
    if (!options.hashedFactorNonce) options.hashedFactorNonce = options.web3AuthClientId;
    if (options.disableSessionManager === undefined) options.disableSessionManager = false;
    this.options = options;
    this.currentStorage = new AsyncStorage(this._storageBaseKey, options.storage);
    if (!options.disableSessionManager) {
      this.sessionManager = new SessionManager({
        sessionTime: options.sessionTime
      });
    }
    Torus.setSessionTime(this.options.sessionTime);
  }
  get tKey() {
    if (this.tkey === null) {
      throw CoreKitError.tkeyInstanceUninitialized();
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
      if (!tkey) return COREKIT_STATUS.NOT_INITIALIZED;
      if (!tkey.metadata) return COREKIT_STATUS.INITIALIZED;
      if (!tkey.secp256k1Key || !this.state.factorKey) return COREKIT_STATUS.REQUIRED_SHARE;
      return COREKIT_STATUS.LOGGED_IN;
    } catch (e) {}
    return COREKIT_STATUS.NOT_INITIALIZED;
  }
  get sessionId() {
    var _this$sessionManager;
    return (_this$sessionManager = this.sessionManager) === null || _this$sessionManager === void 0 ? void 0 : _this$sessionManager.sessionId;
  }
  get supportsAccountIndex() {
    return this._keyType !== KeyType.ed25519;
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
    return this.options.uxMode === UX_MODE.REDIRECT;
  }
  get useClientGeneratedTSSKey() {
    return this.keyType === KeyType.ed25519 && this.options.useClientGeneratedTSSKey === undefined ? true : !!this.options.useClientGeneratedTSSKey;
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
  async init(params = {
    handleRedirectResult: true
  }) {
    var _window2, _window3;
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
        uxMode: this.isNodejsOrRN(this.options.uxMode) ? UX_MODE.REDIRECT : this.options.uxMode,
        network: this.options.web3AuthNetwork,
        redirectPathName: this.options.redirectPathName,
        locationReplaceOnRedirect: true,
        serverTimeOffset: this.options.serverTimeOffset,
        keyType: this.keyType,
        useDkg: this.options.useDKG
      }
    });
    this.storageLayer = new TorusStorageLayer({
      hostUrl: `${new URL(nodeDetails.torusNodeEndpoints[0]).origin}/metadata`,
      enableLogging: this.enableLogging
    });
    const shareSerializationModule = new ShareSerializationModule();
    this.tkey = new TKeyTSS({
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
    } else if (this.options.uxMode === UX_MODE.POPUP) {
      await this.torusSp.init({});
    }
    this.ready = true;

    // try handle redirect flow if enabled and return(redirect) from oauth login
    if (params.handleRedirectResult && this.options.uxMode === UX_MODE.REDIRECT && ((_window2 = window) !== null && _window2 !== void 0 && _window2.location.hash.includes("#state") || (_window3 = window) !== null && _window3 !== void 0 && _window3.location.hash.includes("#access_token"))) {
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
          log.error("rehydrate session error", err);
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
      throw CoreKitError.oauthLoginUnsupported(`Oauth login is NOT supported in ${this.options.uxMode} mode.`);
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
          aggregateVerifierType: aggregateParams.aggregateVerifierType || AGGREGATE_VERIFIER.SINGLE_VERIFIER_ID,
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
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) {
          throw CoreKitError.default(ERRORS.TKEY_SHARES_REQUIRED);
        }
      }
      throw CoreKitError.default(err.message);
    }
  }
  async loginWithJWT(params) {
    this.checkReady();
    const {
      prefetchTssPublicKeys = 1
    } = params;
    if (prefetchTssPublicKeys > 3) {
      throw CoreKitError.prefetchValueExceeded(`The prefetch value '${prefetchTssPublicKeys}' exceeds the maximum allowed limit of 3.`);
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
        userInfo: _objectSpread(_objectSpread({}, parseToken(idToken)), {}, {
          verifier,
          verifierId
        }),
        signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData)
      });
      await this.setupTkey(importTssKey);
    } catch (err) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) {
          const newError = CoreKitError.default(ERRORS.TKEY_SHARES_REQUIRED);
          newError.stack = err.stack;
          throw newError;
        }
      }
      const newError = CoreKitError.default(err.message);
      newError.stack = err.stack;
      throw newError;
    }
  }
  async handleRedirectResult() {
    this.checkReady();
    try {
      const result = await this.torusSp.customAuthInstance.getRedirectResult();
      if (result.method === TORUS_METHOD.TRIGGER_LOGIN) {
        var _data$nodesData;
        const data = result.result;
        if (!data) {
          throw CoreKitError.invalidTorusLoginResponse();
        }
        this.updateState({
          postBoxKey: this._getPostBoxKey(data),
          postboxKeyNodeIndexes: ((_data$nodesData = data.nodesData) === null || _data$nodesData === void 0 ? void 0 : _data$nodesData.nodeIndexes) || [],
          userInfo: data.userInfo,
          signatures: this._getSignatures(data.sessionData.sessionTokenData)
        });
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.verifier;
      } else if (result.method === TORUS_METHOD.TRIGGER_AGGREGATE_LOGIN) {
        var _data$nodesData2;
        const data = result.result;
        if (!data) {
          throw CoreKitError.invalidTorusAggregateLoginResponse();
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
        throw CoreKitError.unsupportedRedirectMethod();
      }
      const userInfo = this.getUserInfo();
      if (!this.state.postBoxKey) {
        throw CoreKitError.postBoxKeyMissing("postBoxKey not present in state after processing redirect result.");
      }
      this.torusSp.postboxKey = new BN(this.state.postBoxKey, "hex");
      this.torusSp.verifierId = userInfo.verifierId;
      await this.setupTkey();
    } catch (error) {
      this.resetState();
      log.error("error while handling redirect result", error);
      throw CoreKitError.default(error.message);
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
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) {
          throw CoreKitError.default(ERRORS.TKEY_SHARES_REQUIRED);
        }
      }
      throw CoreKitError.default(err.message);
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
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when getting current factor key.");
    }
    if (!this.state.tssShareIndex) {
      throw CoreKitError.tssShareTypeIndexMissing("TSS Share Type (Index) not present in state when getting current factor key.");
    }
    try {
      return {
        factorKey: this.state.factorKey,
        shareType: this.state.tssShareIndex
      };
    } catch (err) {
      log.error("state error", err);
      throw CoreKitError.default(err.message);
    }
  }
  async enableMFA(enableMFAParams, recoveryFactor = true) {
    this.checkReady();
    const {
      postBoxKey
    } = this.state;
    const hashedFactorKey = getHashedPrivateKey(postBoxKey, this.options.hashedFactorNonce);
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
        shareType: TssShareType.DEVICE,
        additionalMetadata: browserData
      }), "hex");
      await this.setDeviceFactor(deviceFactorKey);
      await this.inputFactorKey(new BN(deviceFactorKey, "hex"));
      const hashedFactorPub = getPubKeyPoint(hashedFactorKey, factorKeyCurve);
      await this.deleteFactor(hashedFactorPub, hashedFactorKey);
      await this.deleteMetadataShareBackup(hashedFactorKey);

      // only recovery factor = true
      let backupFactorKey;
      if (recoveryFactor) {
        backupFactorKey = await this.createFactor(_objectSpread({
          shareType: TssShareType.RECOVERY
        }, enableMFAParams));
      }

      // update to undefined for next major release
      return backupFactorKey;
    }).catch(reason => {
      log.error("error enabling MFA:", reason.message);
      const err = CoreKitError.default(reason.message);
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
      await this.addFactorDescription({
        factorKey,
        shareDescription,
        additionalMetadata,
        updateMetadata: false
      });
      return scalarBNToBufferSEC1(factorKey).toString("hex");
    }).catch(reason => {
      log.error("error creating factor:", reason.message);
      const err = CoreKitError.default(`error creating factor: ${reason.message}`);
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
    return Point.fromSEC1(this.tkey.tssCurve, tssPubKey.toString("hex"));
  }

  /**
   * Get public key in ed25519 format.
   *
   * Throws an error if keytype is not compatible with ed25519.
   */
  getPubKeyEd25519() {
    const p = this.tkey.tssCurve.keyFromPublic(this.getPubKey()).getPublic();
    return ed25519().keyFromPublic(p).getPublic();
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
    } = fetchLocalConfig(this.options.web3AuthNetwork, this.keyType);
    if (!this.state.factorKey) {
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when signing.");
    }
    const {
      tssShare
    } = await this.tKey.getTSSShare(this.state.factorKey, {
      accountIndex: 0
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
    const {
      nodeIndexes
    } = await this.torusSp.getTSSPubKey(this.tKey.tssTag, this.tKey.metadata.tssNonces[this.tKey.tssTag]);
    const {
      endpoints,
      tssWSEndpoints,
      partyIndexes,
      nodeIndexesReturned: participatingServerDKGIndexes
    } = generateTSSEndpoints(torusNodeTSSEndpoints, parties, clientIndex, nodeIndexes);

    // Setup sockets.
    const sockets = await setupSockets(tssWSEndpoints, randomSessionNonce);
    const dklsCoeff = getDKLSCoeff(true, participatingServerDKGIndexes, tssShareIndex);
    const denormalisedShare = dklsCoeff.mul(tssShare).umod(secp256k1.curve.n);
    const accountNonce = this.tkey.computeAccountNonce(this.state.accountIndex);
    const derivedShare = denormalisedShare.add(accountNonce).umod(secp256k1.curve.n);
    const share = scalarBNToBufferSEC1(derivedShare).toString("base64");
    if (!currentSession) {
      throw CoreKitError.activeSessionNotFound();
    }
    const {
      signatures
    } = this;
    if (!signatures) {
      throw CoreKitError.signaturesNotPresent();
    }

    // Client lib expects pub key in XY-format, base64-encoded.
    const tssPubKeyBase64 = Buffer.from(tssPubKey.toSEC1(secp256k1).subarray(1)).toString("base64");
    const client = new Client(currentSession, clientIndex, partyIndexes, endpoints, sockets, share, tssPubKeyBase64, true, this.wasmLib);
    const serverCoeffs = {};
    for (let i = 0; i < participatingServerDKGIndexes.length; i++) {
      const serverIndex = participatingServerDKGIndexes[i];
      serverCoeffs[serverIndex] = getDKLSCoeff(false, participatingServerDKGIndexes, tssShareIndex, serverIndex).toString("hex");
    }
    client.precompute({
      signatures,
      server_coeffs: serverCoeffs,
      nonce: scalarBNToBufferSEC1(this.getAccountNonce()).toString("base64")
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
    if (this.keyType === KeyType.secp256k1) {
      const sig = await this.sign_ECDSA_secp256k1(data, hashed, secp256k1Precompute);
      return Buffer.concat([sig.r, sig.s, Buffer.from([sig.v])]);
    } else if (this.keyType === KeyType.ed25519) {
      return this.sign_ed25519(data, hashed);
    }
    throw CoreKitError.default(`sign not supported for key type ${this.keyType}`);
  }

  // mutation function
  async deleteFactor(factorPub, factorKey) {
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
      await this.tKey.deleteFactorPub({
        factorKey: this.state.factorKey,
        deleteFactorPub: factorPub,
        authSignatures: this.signatures
      });
      const factorPubHex = fpp.toSEC1(factorKeyCurve, true).toString("hex");
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
        const derivedFactorPub = getPubKeyPoint(factorKeyBN, factorKeyCurve);
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
      throw CoreKitError.userNotLoggedIn();
    }
    return this.state.userInfo;
  }
  getKeyDetails() {
    this.checkReady();
    const tkeyDetails = this.tKey.getKeyDetails();
    const tssPubKey = this.state.tssPubKey ? Point.fromSEC1(this.tkey.tssCurve, this.state.tssPubKey.toString("hex")) : undefined;
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
      throw CoreKitError.factorKeyNotPresent("factorKey not present in state when committing changes.");
    }
    try {
      // in case for manualsync = true, _syncShareMetadata will not call syncLocalMetadataTransitions()
      // it will not create a new LocalMetadataTransition
      // manual call syncLocalMetadataTransitions() required to sync local transitions to storage
      await this.tKey._syncShareMetadata();
      await this.tKey.syncLocalMetadataTransitions();
    } catch (error) {
      log.error("sync metadata error", error);
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
        throw CoreKitError.default("Device factor already exists");
      }
    }
    const metadata = this.tKey.getMetadata();
    const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    await this.currentStorage.set(tkeyPubX, JSON.stringify({
      factorKey: factorKey.toString("hex").padStart(64, "0")
    }));
  }
  async getDeviceFactor() {
    const metadata = this.tKey.getMetadata();
    const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
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
      authSignatures: this.state.signatures
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
  async _UNSAFE_exportTssEd25519Seed() {
    if (this.keyType !== KeyType.ed25519) {
      throw CoreKitError.default("Wrong KeyType. Method can only be used when KeyType is ed25519");
    }
    if (!this.state.factorKey) throw CoreKitError.factorKeyNotPresent("factorKey not present in state when exporting tss ed25519 seed.");
    if (!this.state.signatures) throw CoreKitError.signaturesNotPresent("Signatures not present in state when exporting tss ed25519 seed.");
    try {
      const exportEd25519Seed = await this.tKey._UNSAFE_exportTssEd25519Seed({
        factorKey: this.state.factorKey,
        authSignatures: this.state.signatures
      });
      return exportEd25519Seed;
    } catch (error) {
      throw CoreKitError.default(`Error exporting ed25519 seed: ${error}`);
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
  async importTssKey(tssKey, factorPub, newTSSIndex = TssShareType.DEVICE) {
    if (!this.state.signatures) {
      throw CoreKitError.signaturesNotPresent("Signatures not present in state when importing tss key.");
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
      throw CoreKitError.tssNoncesMissing(`tssNonce not present for tag ${this.tKey.tssTag}`);
    }
    const tssNonce = this.tKey.metadata.tssNonces[this.tKey.tssTag];
    return tssNonce;
  }
  async setupTkey(providedImportTssKey) {
    if (!this.state.postBoxKey) {
      throw CoreKitError.userNotLoggedIn();
    }
    const existingUser = await this.isMetadataPresent(this.state.postBoxKey);
    let importTssKey = providedImportTssKey;
    if (!existingUser) {
      if (!importTssKey && this.useClientGeneratedTSSKey) {
        if (this.keyType === KeyType.ed25519) {
          const k = generateEd25519Seed();
          importTssKey = k.toString("hex");
        } else if (this.keyType === KeyType.secp256k1) {
          const k = secp256k1.genKeyPair().getPrivate();
          importTssKey = scalarBNToBufferSEC1(k).toString("hex");
        } else {
          throw CoreKitError.default("Unsupported key type");
        }
      }
      await this.handleNewUser(importTssKey);
    } else {
      if (importTssKey) {
        throw CoreKitError.tssKeyImportNotAllowed();
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
        const ec$1 = new ec(this.keyType);
        const deviceTSSShare = ec$1.genKeyPair().getPrivate();
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
          shareDescription: FactorKeyTypeShareDescription.Other,
          updateMetadata: false
        });
      } else {
        await this.addFactorDescription({
          factorKey,
          shareDescription: FactorKeyTypeShareDescription.HashedShare,
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
    const hashedFactorKey = getHashedPrivateKey(this.state.postBoxKey, this.options.hashedFactorNonce);
    this.state.factorKey = hashedFactorKey;
    if (await this.checkIfFactorKeyValid(hashedFactorKey)) {
      // Initialize tkey with existing hashed share if available.
      const factorKeyMetadata = await this.getFactorKeyMetadata(hashedFactorKey);
      try {
        await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
        await this.tKey.reconstructKey();
        await this.finalizeTkey(hashedFactorKey);
      } catch (err) {
        log.error("error initializing tkey with hashed share", err);
      }
    } else {
      var _this$tKey2;
      const factorKeyMetadata = await ((_this$tKey2 = this.tKey) === null || _this$tKey2 === void 0 ? void 0 : _this$tKey2.readMetadata(hashedFactorKey));
      if (factorKeyMetadata.message === "SHARE_DELETED") {
        // throw CoreKitError.hashedFactorDeleted();
        log.warn("hashed factor deleted");
      }
    }
  }
  async finalizeTkey(factorKey) {
    if (this.state.accountIndex !== 0) {
      log.warn("AccountIndex should be 0");
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
      throw CoreKitError.mpcCoreKitNotInitialized();
    }
  }
  async rehydrateSession(result) {
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
      log.warn("failed to authorize session", err);
    }
  }
  async createSession() {
    if (!this.options.disableSessionManager && !this.sessionManager) {
      throw new Error("sessionManager is not available");
    }
    try {
      const sessionId = SessionManager.generateRandomSessionKey();
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
        throw CoreKitError.factorKeyNotPresent("factorKey not present in state when creating session.");
      }
      const {
        tssShare
      } = await this.tKey.getTSSShare(this.state.factorKey, {
        accountIndex: this.state.accountIndex
      });
      if (!postBoxKey || !factorKey || !tssShare || !tssPubKey || !userInfo) {
        throw CoreKitError.userNotLoggedIn();
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
      log.error("error creating session", err);
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
  async copyOrCreateShare(newFactorTSSIndex, newFactorPub) {
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
        if (shareIndex !== SOCIAL_TKEY_INDEX.toString()) {
          share = shares[shareIndex];
        }
      }
      if (!share) {
        throw CoreKitError.noMetadataShareFound();
      }
      return share;
    } catch (err) {
      log.error("create device share error", err);
      throw CoreKitError.default(err.message);
    }
  }
  async deleteMetadataShareBackup(factorKey) {
    var _this$tkey, _this$tkey2;
    await this.tKey.addLocalMetadataTransitions({
      input: [{
        message: SHARE_DELETED,
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
    const factorPoint = getPubKeyPoint(factorKey, factorKeyCurve);
    const factorPub = factorPoint.toSEC1(factorKeyCurve, true).toString("hex");
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
    return Torus.getPostboxKey(result);
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
    const accessUrl = SIGNER_MAP[this.options.web3AuthNetwork];
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
      throw CoreKitError.default(errMessage.error);
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
        r: scalarBNToBufferSEC1(r),
        s: scalarBNToBufferSEC1(s)
      };
    };
    if (!hashed) {
      data = keccak256$1(data);
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
      throw CoreKitError.signaturesNotPresent();
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
      throw CoreKitError.default("hashed data not supported for ed25519");
    }
    const nodeDetails = fetchLocalConfig(this.options.web3AuthNetwork, "ed25519");
    if (!nodeDetails.torusNodeTSSEndpoints) {
      throw CoreKitError.default("could not fetch tss node endpoints");
    }

    // Endpoints must end with backslash, but URLs returned by
    // `fetch-node-details` don't have it.
    const ED25519_ENDPOINTS = nodeDetails.torusNodeTSSEndpoints.map((ep, i) => ({
      index: nodeDetails.torusIndexes[i],
      url: `${ep}/`
    }));

    // Select endpoints and derive party indices.
    const serverThreshold = Math.floor(ED25519_ENDPOINTS.length / 2) + 1;
    const endpoints = sampleEndpoints(ED25519_ENDPOINTS, serverThreshold);
    const serverXCoords = endpoints.map(x => x.index);
    const clientXCoord = Math.max(...endpoints.map(ep => ep.index)) + 1;

    // Derive share coefficients for flat hierarchy.
    const ec = new Ed25519Curve();
    const {
      serverCoefficients,
      clientCoefficient
    } = deriveShareCoefficients(ec, serverXCoords, clientXCoord, this.state.tssShareIndex);

    // Get pub key.
    const tssPubKey = await this.getPubKey();
    const tssPubKeyPoint = ec.keyFromPublic(tssPubKey).getPublic();

    // Get client key share and adjust by coefficient.
    if (this.state.accountIndex !== 0) {
      throw CoreKitError.default("Account index not supported for ed25519");
    }
    const {
      tssShare
    } = await this.tKey.getTSSShare(this.state.factorKey);
    const clientShareAdjusted = tssShare.mul(clientCoefficient).umod(ec.n);
    const clientShareAdjustedHex = ec.scalarToBuffer(clientShareAdjusted, Buffer).toString("hex");

    // Generate session identifier.
    const tssNonce = this.getTssNonce();
    const sessionNonce = generateSessionNonce();
    const session = getSessionId(this.verifier, this.verifierId, this.tKey.tssTag, tssNonce, sessionNonce);

    // Run signing protocol.
    const serverURLs = endpoints.map(x => x.url);
    const pubKeyHex = ec.pointToBuffer(tssPubKeyPoint, Buffer).toString("hex");
    const serverCoefficientsHex = serverCoefficients.map(c => ec.scalarToBuffer(c, Buffer).toString("hex"));
    const signature = await sign(this.wasmLib, session, this.signatures, serverXCoords, serverURLs, clientXCoord, clientShareAdjustedHex, pubKeyHex, data, serverCoefficientsHex);
    log.info(`signature: ${signature}`);
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

export { AsyncStorage, COREKIT_STATUS, DELIMITERS, ERRORS, FIELD_ELEMENT_HEX_LEN, FactorKeyTypeShareDescription, MAX_FACTORS, MemoryStorage, SCALAR_LEN, SOCIAL_FACTOR_INDEX, SOCIAL_TKEY_INDEX, TssSecurityQuestion, TssSecurityQuestionStore, TssShareType, USER_PATH, VALID_SHARE_INDICES, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit, deriveShareCoefficients, ed25519, fraction, generateEd25519Seed, generateFactorKey, generateSessionNonce, generateTSSEndpoints, getHashedPrivateKey, getSessionId, keyToMnemonic, lagrangeCoefficient, lagrangeCoefficients, log, makeEthereumSigner, mnemonicToKey, parseToken, randomBytes, sampleEndpoints, scalarBNToBufferSEC1, sigToRSV, storageAvailable };
