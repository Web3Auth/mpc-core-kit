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
export declare class CustomError extends Error {
    name: string;
    constructor(message?: string, options?: ErrorOptions);
}
interface ICoreKitError extends CustomError {
    name: string;
    code: number;
    message: string;
    toString(): string;
}
declare abstract class AbstractCoreKitError extends CustomError implements ICoreKitError {
    code: number;
    message: string;
    constructor(code?: number, message?: string);
    toJSON(): ICoreKitError;
    toString(): string;
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
declare class CoreKitError extends AbstractCoreKitError {
    protected static messages: {
        [key: number]: string;
    };
    constructor(code: number, message: string);
    static fromCode(code: number, extraMessage?: string): ICoreKitError;
    static default(extraMessage?: string): ICoreKitError;
    static chainConfigInvalid(extraMessage?: string): ICoreKitError;
    static clientIdInvalid(extraMessage?: string): ICoreKitError;
    static storageTypeUnsupported(extraMessage?: string): ICoreKitError;
    static oauthLoginUnsupported(extraMessage?: string): ICoreKitError;
    static noValidStorageOptionFound(extraMessage?: string): ICoreKitError;
    static noDataFoundInStorage(extraMessage?: string): ICoreKitError;
    static invalidConfig(extraMessage?: string): ICoreKitError;
    static tssLibRequired(extraMessage?: string): ICoreKitError;
    static tkeyInstanceUninitialized(extraMessage?: string): ICoreKitError;
    static duplicateTssIndex(extraMessage?: string): ICoreKitError;
    static nodeDetailsRetrievalFailed(extraMessage?: string): ICoreKitError;
    static prefetchValueExceeded(extraMessage?: string): ICoreKitError;
    static invalidTorusLoginResponse(extraMessage?: string): ICoreKitError;
    static invalidTorusAggregateLoginResponse(extraMessage?: string): ICoreKitError;
    static unsupportedRedirectMethod(extraMessage?: string): ICoreKitError;
    static postBoxKeyMissing(extraMessage?: string): ICoreKitError;
    static tssShareTypeIndexMissing(extraMessage?: string): ICoreKitError;
    static tssPublicKeyOrEndpointsMissing(extraMessage?: string): ICoreKitError;
    static activeSessionNotFound(extraMessage?: string): ICoreKitError;
    static tssNoncesMissing(extraMessage?: string): ICoreKitError;
    static tssKeyImportNotAllowed(extraMessage?: string): ICoreKitError;
    static factorKeyNotPresent(extraMessage?: string): ICoreKitError;
    static factorKeyAlreadyExists(extraMessage?: string): ICoreKitError;
    static mfaAlreadyEnabled(extraMessage?: string): ICoreKitError;
    static cannotDeleteLastFactor(extraMessage?: string): ICoreKitError;
    static factorInUseCannotBeDeleted(extraMessage?: string): ICoreKitError;
    static userNotLoggedIn(extraMessage?: string): ICoreKitError;
    static providedFactorKeyInvalid(extraMessage?: string): ICoreKitError;
    static factorEncsMissing(extraMessage?: string): ICoreKitError;
    static noMetadataFound(extraMessage?: string): ICoreKitError;
    static newShareIndexInvalid(extraMessage?: string): ICoreKitError;
    static maximumFactorsReached(extraMessage?: string): ICoreKitError;
    static noMetadataShareFound(extraMessage?: string): ICoreKitError;
    static signaturesNotPresent(extraMessage?: string): ICoreKitError;
    static factorPubsMissing(extraMessage?: string): ICoreKitError;
    static commitChangesBeforeMFA(extraMessage?: string): ICoreKitError;
    static mpcCoreKitNotInitialized(extraMessage?: string): ICoreKitError;
}
export default CoreKitError;
