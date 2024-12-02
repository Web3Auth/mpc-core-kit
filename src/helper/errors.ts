/**
 * Fix the prototype chain of the error
 *
 * Use Object.setPrototypeOf
 * Support ES6 environments
 *
 * Fallback setting __proto__
 * Support IE11+, see https://docs.microsoft.com/en-us/scripting/javascript/reference/javascript-version-information
 */
function fixProto(target: Error, prototype: object) {
  const { setPrototypeOf } = Object;
  if (setPrototypeOf) {
    setPrototypeOf(target, prototype);
  } else {
    // eslint-disable-next-line no-proto, @typescript-eslint/no-explicit-any
    (target as any).__proto__ = prototype;
  }
}

/**
 * Capture and fix the error stack when available
 *
 * Use Error.captureStackTrace
 * Support v8 environments
 */
function fixStack(target: Error, fn = target.constructor) {
  const { captureStackTrace } = Error;
  if (captureStackTrace) {
    captureStackTrace(target, fn);
  }
}

// copy from https://github.com/microsoft/TypeScript/blob/main/lib/lib.es2022.error.d.ts
// avoid typescript isue https://github.com/adriengibrat/ts-custom-error/issues/81
interface ErrorOptions {
  cause?: unknown;
}

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
export class CustomError extends Error {
  name: string;

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    // set error name as constructor name, make it not enumerable to keep native Error behavior
    // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target#new.target_in_constructors
    // see https://github.com/adriengibrat/ts-custom-error/issues/30
    Object.defineProperty(this, "name", {
      value: new.target.name,
      enumerable: false,
      configurable: true,
    });
    // fix the extended error prototype chain
    // because typescript __extends implementation can't
    // see https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
    fixProto(this, new.target.prototype);
    // try to remove contructor from stack trace
    fixStack(this);
  }
}

interface ICoreKitError extends CustomError {
  name: string;
  code: number;
  message: string;
  toString(): string;
}

abstract class AbstractCoreKitError extends CustomError implements ICoreKitError {
  code: number;

  message: string;

  public constructor(code?: number, message?: string) {
    // takes care of stack and proto
    super(message);

    this.code = code;
    this.message = message || "";
    // Set name explicitly as minification can mangle class names
    Object.defineProperty(this, "name", { value: "TkeyError" });
  }

  toJSON(): ICoreKitError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
    };
  }

  toString(): string {
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
  protected static messages: { [key: number]: string } = {
    // Configuration errors
    1001: "You must specify a valid eip155 chain configuration in the options.",
    1002: "You must specify a web3auth clientId.",
    1003: "Unsupported storage type in this UX mode.",
    1004: "OAuth login is NOT supported in this UX mode.",
    1005: "No valid storage option found.",
    1006: "No data found in storage.",
    1007: "Invalid config.",
    1008: "Invalid key type.",
    1009: "Invalid signature type.",

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
    1302: "The MPC Core Kit is not initialized. Please ensure you call the 'init()' method to initialize the kit properly before attempting any operations.",
  };

  public constructor(code: number, message: string) {
    super(code, message);
    Object.defineProperty(this, "name", { value: "CoreKitError" });
  }

  public static fromCode(code: number, extraMessage = ""): ICoreKitError {
    return new CoreKitError(code, `${CoreKitError.messages[code]} ${extraMessage}`);
  }

  public static default(extraMessage = ""): ICoreKitError {
    return new CoreKitError(1000, `${CoreKitError.messages[1000]} ${extraMessage}`);
  }

  // Configuration errors
  public static chainConfigInvalid(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1001, extraMessage);
  }

  public static clientIdInvalid(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1002, extraMessage);
  }

  public static storageTypeUnsupported(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1003, extraMessage);
  }

  public static oauthLoginUnsupported(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1004, extraMessage);
  }

  public static noValidStorageOptionFound(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1005, extraMessage);
  }

  public static noDataFoundInStorage(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1006, extraMessage);
  }

  public static invalidConfig(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1007, extraMessage);
  }

  public static invalidKeyType(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1008, extraMessage);
  }

  public static invalidSigType(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1009, extraMessage);
  }

  // TSS and key management errors
  public static tssLibRequired(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1101, extraMessage);
  }

  public static tkeyInstanceUninitialized(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1102, extraMessage);
  }

  public static duplicateTssIndex(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1103, extraMessage);
  }

  public static nodeDetailsRetrievalFailed(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1104, extraMessage);
  }

  public static prefetchValueExceeded(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1105, extraMessage);
  }

  public static invalidTorusLoginResponse(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1106, extraMessage);
  }

  public static invalidTorusAggregateLoginResponse(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1107, extraMessage);
  }

  public static unsupportedRedirectMethod(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1108, extraMessage);
  }

  public static postBoxKeyMissing(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1109, extraMessage);
  }

  public static tssShareTypeIndexMissing(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1110, extraMessage);
  }

  public static tssPublicKeyOrEndpointsMissing(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1111, extraMessage);
  }

  public static activeSessionNotFound(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1112, extraMessage);
  }

  public static tssNoncesMissing(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1113, extraMessage);
  }

  public static tssKeyImportNotAllowed(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1114, extraMessage);
  }

  // Factor key and authentication errors
  public static factorKeyNotPresent(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1201, extraMessage);
  }

  public static factorKeyAlreadyExists(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1202, extraMessage);
  }

  public static mfaAlreadyEnabled(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1203, extraMessage);
  }

  public static cannotDeleteLastFactor(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1204, extraMessage);
  }

  public static factorInUseCannotBeDeleted(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1205, extraMessage);
  }

  public static userNotLoggedIn(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1206, extraMessage);
  }

  public static providedFactorKeyInvalid(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1207, extraMessage);
  }

  public static factorEncsMissing(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1208, extraMessage);
  }

  public static noMetadataFound(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1209, extraMessage);
  }

  public static newShareIndexInvalid(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1210, extraMessage);
  }

  public static maximumFactorsReached(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1211, extraMessage);
  }

  public static noMetadataShareFound(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1212, extraMessage);
  }

  public static signaturesNotPresent(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1213, extraMessage);
  }

  public static factorPubsMissing(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1214, extraMessage);
  }

  // Initialization and session management
  public static commitChangesBeforeMFA(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1301, extraMessage);
  }

  public static mpcCoreKitNotInitialized(extraMessage = ""): ICoreKitError {
    return CoreKitError.fromCode(1302, extraMessage);
  }
}

export default CoreKitError;
