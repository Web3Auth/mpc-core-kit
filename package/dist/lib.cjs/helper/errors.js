'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var _defineProperty = require('@babel/runtime/helpers/defineProperty');

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

exports.CustomError = CustomError;
exports.default = CoreKitError;
