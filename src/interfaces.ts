import { KeyDetails, Point, ShareStore } from "@tkey-mpc/common-types";
import ThresholdKey from "@tkey-mpc/core";
import type {
  AGGREGATE_VERIFIER_TYPE,
  ExtraParams,
  LoginWindowResponse,
  SubVerifierDetails,
  TorusVerifierResponse,
  UX_MODE_TYPE,
  WebAuthnExtraParams,
} from "@toruslabs/customauth";
import { CustomChainConfig, SafeEventEmitterProvider } from "@web3auth/base";
import BN from "bn.js";

import { FactorKeyTypeShareDescription, ShareType, USER_PATH, WEB3AUTH_NETWORK } from "./constants";

export interface IStorage {
  getItem(key: string): string;
  setItem(key: string, value: string): void;
}

export interface BaseLoginParams {
  // offset in seconds
  serverTimeOffset?: number;
}

export interface SubVerifierDetailsParams extends BaseLoginParams {
  subVerifierDetails: SubVerifierDetails;
}

export interface AggregateVerifierLoginParams extends BaseLoginParams {
  aggregateVerifierIdentifier?: string;
  aggregateVerifierType?: AGGREGATE_VERIFIER_TYPE;
  subVerifierDetailsArray?: SubVerifierDetails[];
}

export type LoginParams = SubVerifierDetailsParams | AggregateVerifierLoginParams;
export type UserInfo = TorusVerifierResponse & LoginWindowResponse;

export interface IdTokenLoginParams {
  /**
   * Name of the verifier created on Web3Auth Dashboard. In case of Aggregate Verifier, the name of the top level aggregate verifier.
   */
  verifier: string;

  /**
   * Unique Identifier for the User. The verifier identifier field set for the verifier/ sub verifier. E.g. "sub" field in your on jwt id token.
   */
  verifierId: string;

  /**
   * The idToken received from the Auth Provider.
   */
  idToken: string;

  /**
   * Name of the sub verifier in case of aggregate verifier setup. This field should only be provided in case of an aggregate verifier.
   */
  subVerifier?: string;

  /**
   * Extra verifier params in case of a WebAuthn verifier type.
   */
  extraVerifierParams?: WebAuthnExtraParams;

  /**
   * Any additional parameter (key value pair) you'd like to pass to the login function.
   */
  additionalParams?: ExtraParams;
}

// TODO extend interface and type documentation wherever necessary. @Yash
export interface ICoreKit {
  /** The tKey SDK instance
   *  TKey is the core module on which this wrapper SDK sits for easy integration.
   **/
  tKey: ThresholdKey | undefined;

  // TODO document errors across all interface methods! maybe even define error
  // codes and document which are thrown. in particular here, error is thrown if
  // not factor key is given (either as function parameter or through local
  // storage)
  /**
   * Login into the SDK in an implicit flow and initialize all relevant components.
   * @param loginParams - Parameters for Implicit Login.
   * @param factorKey - A BN used for encrypting your Device/ Recovery TSS Key Share. Optional for new users, mandatory for existing users, if not provided we will try to fetch it from local storage.
   * @returns A Web3 provider if we are not in redirect mode.
   */
  login(loginParams: LoginParams, factorKey?: BN): Promise<SafeEventEmitterProvider | null>;

  /**
   * Login into the SDK using ID Token based login and initialize all relevant components.
   * @param idTokenLoginParams - Parameters with ID Token based Login.
   * @param factorKey - A BN used for encrypting your Device/ Recovery TSS Key Share. Optional for new users, mandatory for existing users, if not provided we will try to fetch it from local storage.
   * @returns A Web3 provider
   */
  loginWithIdToken(idTokenLoginParams: IdTokenLoginParams, factorKey?: BN): Promise<SafeEventEmitterProvider | null>;

  /**
   * Handle redirect result after login.
   * @param factorKey - A BN used for encrypting your Device/ Recovery TSS Key Share. Optional for new users, mandatory for existing users, if not provided we will try to fetch it from local storage.
   * @returns A Web3 provider.
   */
  handleRedirectResult(factorKey?: BN): Promise<SafeEventEmitterProvider>;

  /**
   * Indicates whether there is an existing session that can be resumed.
   * @returns `true`: Session Exists, `false`: Session does not exist.
   */
  isResumable(): boolean;

  /**
   * Resumes an existing session.
   * @returns A Web3 Provider.
   */
  resumeSession(): Promise<SafeEventEmitterProvider>;

  /**
   * Logs out the user, terminating the session.
   */
  logout(): Promise<void>;

  /**
   * Creates a new factor for authentication.
   * @param factorKey - A BN used for encrypting your Device/ Recovery TSS Key Share. You can generate it using `generateFactorKey()` function or use an existing one.
   * @param shareType - Setting the Type of Share - Device or Recovery. Default is DEVICE.
   * @param shareDescription - Setting the Description of Share - Security Questions, Device Share, Seed Phrase, Password Share, Social Share, Other. Default is Other.
   * @param additionalMetadata - Additional metadata information you want to be stored alongside this factor for easy identification.
   * @returns A promise that resolves to the factor key.
   */
  createFactor(
    factorKey: BN,
    shareType?: ShareType,
    shareDescription?: FactorKeyTypeShareDescription,
    additionalMetadata?: Record<string, string>
  ): Promise<void>;

  // TODO throw error if we would go below threshold! @Himanshu, @CW
  /**
   * Deletes the factor identified by the given public key, including all
   * associated metadata.
   * @param factorPub - The public key of the factor to delete.
   */
  deleteFactor(factorPub: Point): Promise<void>;

  /**
   * Generates a new factor key.
   * A factor key is a BN used for encrypting your Device/ Recovery TSS Key Shares.
   *
   * @returns The freshly generated factor key and the corresponding public key.
   */
  generateFactorKey(): { private: BN; pub: Point };

  /**
   * Get user information provided by the OAuth provider.
   */
  getUserInfo(): UserInfo;

  /**
   * Get information about how the keys of the user is managed according to the information in the metadata server.
   */
  getKeyDetails(): KeyDetails & { tssIndex: number };

  /**
   * Commit the changes made to the user's account when in manual sync mode.
   */
  commitChanges(): Promise<void>;

  // TODO Himanshu: remove function here? instead use tkey function if we need it for demo.
  /**
   * WARNING: Use with caution.
   *
   * Resets the user's account. All funds will be lost.
   */
  CRITICAL_resetAccount(): Promise<void>;

  // TODO add function for "import tss key share"
}

export type WEB3AUTH_NETWORK_TYPE = (typeof WEB3AUTH_NETWORK)[keyof typeof WEB3AUTH_NETWORK];

export type USER_PATH_TYPE = (typeof USER_PATH)[keyof typeof USER_PATH];

export interface Web3AuthOptions {
  /**
   * The Web3Auth Client ID for your application. Find one at https://dashboard.web3auth.io
   */
  web3AuthClientId: string;

  /**
   * Chain Config for the chain you want to connect to. Currently supports only EVM based chains.
   */
  chainConfig?: CustomChainConfig;

  /**
   * @defaultValue `false`
   */
  manualSync?: boolean;

  /**
   * @defaultValue `${window.location.origin}/serviceworker`
   */
  baseUrl?: string;

  /**
   *
   * @defaultValue `'sapphire_mainner'`
   */
  web3AuthNetwork?: WEB3AUTH_NETWORK_TYPE;

  /**
   *
   * @defaultValue `'local'`
   */
  storageKey?: "session" | "local";

  /**
   * @defaultValue 86400
   */
  sessionTime?: number;

  /**
   * @defaultValue `'POPUP'`
   */
  uxMode?: UX_MODE_TYPE;

  /**
   * @defaultValue `false`
   * enables logging of the internal packages.
   */
  enableLogging?: boolean;
}

export interface Web3AuthState {
  oAuthKey?: string;
  signatures?: string[];
  userInfo?: UserInfo;
  tssNonce?: number;
  tssShare?: BN;
  tssShareIndex?: number;
  tssPubKey?: Buffer;
  factorKey?: BN;
  tssNodeEndpoints?: string[];
}

export type FactorKeyCloudMetadata = {
  share: ShareStore;
  tssShare: BN;
  tssIndex: number;
};

export interface SessionData {
  oAuthKey: string;
  factorKey: string;
  tssNonce: number;
  tssShare: string;
  tssShareIndex: number;
  tssPubKey: string;
  signatures: string[];
  userInfo: UserInfo;
}

export interface TkeyLocalStoreData {
  factorKey: string;
}
