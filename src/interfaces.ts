import { KeyDetails, Point as TkeyPoint, ShareStore } from "@tkey-mpc/common-types";
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

import { FactorKeyTypeShareDescription, TssShareType, USER_PATH, WEB3AUTH_NETWORK } from "./constants";
export interface IStorage {
  getItem(key: string): string | null;
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

export interface IFactorKey {
  factorKey: BN;
  shareType: TssShareType;
}

export enum COREKIT_STATUS {
  NOT_INITIALIZED = "NOT_INITIALIZED",
  INITIALIZED = "INITIALIZED",
  REQUIRED_SHARE = "REQUIRED_SHARE",
  LOGGED_IN = "LOGGED_IN",
}

export type OauthLoginParams = SubVerifierDetailsParams | AggregateVerifierLoginParams;
export type UserInfo = TorusVerifierResponse & LoginWindowResponse;

export interface CreateFactorParams {
  /**
   * Setting the Type of Share - Device or Recovery.
   **/
  shareType: TssShareType;
  /**
   * A BN used for encrypting your Device/ Recovery TSS Key Share. You can generate it using `generateFactorKey()` function or use an existing one.
   */
  factorKey?: BN;
  /**
   * Setting the Description of Share - Security Questions, Device Share, Seed Phrase, Password Share, Social Share, Other. Default is Other.
   */
  shareDescription?: FactorKeyTypeShareDescription;
  /**
   * Additional metadata information you want to be stored alongside this factor for easy identification.
   */
  additionalMetadata?: Record<string, string>;
}

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

export interface Web3AuthState {
  oAuthKey?: string;
  signatures?: string[];
  userInfo?: UserInfo;
  tssShareIndex?: number;
  tssPubKey?: Buffer;
  factorKey?: BN;
  tssNodeEndpoints?: string[];
}

export interface ICoreKit {
  /**
   * The tKey instance, if initialized.
   * TKey is the core module on which this wrapper SDK sits for easy integration.
   **/
  tKey: ThresholdKey | null;

  /**
   * Provider for making the blockchain calls.
   **/
  provider: SafeEventEmitterProvider | null;

  /**
   * Signatures generated from the OAuth Login.
   **/
  signatures: string[] | null;

  /**
   * Status of the current MPC Core Kit Instance
   **/
  status: COREKIT_STATUS;

  /**
   * The current sdk state.
   */
  state: Web3AuthState;

  /**
   * The current session id.
   */
  sessionId: string;

  /**
   * The function used to initailise the state of MPCCoreKit
   * Also is useful to resume an existing session.
   */
  init(): Promise<void>;

  /**
   * Login into the SDK in an implicit flow and initialize all relevant components.
   * @param loginParams - Parameters for Implicit Login.
   */
  loginWithOauth(loginParams: OauthLoginParams): Promise<void>;

  /**
   * Login into the SDK using ID Token based login and initialize all relevant components.
   * @param idTokenLoginParams - Parameters with ID Token based Login.
   */
  loginWithJWT(idTokenLoginParams: IdTokenLoginParams): Promise<void>;

  /**
   * Handle redirect result after login.
   */
  handleRedirectResult(): Promise<void>;

  /**
   * Second step for login where the user inputs their factor key.
   * @param factorKey: A BN used for encrypting your Device/ Recovery TSS Key Share. You can generate it using `generateFactorKey()` function or use an existing one.
   */
  inputFactorKey(factorKey: BN): Promise<void>;

  /**
   * Returns the current Factor Key and TssShareType in MPC Core Kit State
   **/
  getCurrentFactorKey(): IFactorKey;

  /**
   * Creates a new factor for authentication.
   * @param CreateFactorParams - Parameters for creating a new factor.
   */
  createFactor(CreateFactorParams: CreateFactorParams): Promise<string>;

  /**
   * Deletes the factor identified by the given public key, including all
   * associated metadata.
   * @param factorPub - The public key of the factor to delete.
   */
  deleteFactor(factorPub: TkeyPoint): Promise<void>;

  /**
   * Logs out the user, terminating the session.
   */
  logout(): Promise<void>;

  /**
   * Get user information provided by the OAuth provider.
   */
  getUserInfo(): UserInfo;

  /**
   * Get information about how the keys of the user is managed according to the information in the metadata server.
   */
  getKeyDetails(): KeyDetails;

  /**
   * Commit the changes made to the user's account when in manual sync mode.
   */
  commitChanges(): Promise<void>;

  /**
   * Import an existing private key into the Web3Auth MPC Infrastructure.
   */
  importTssKey(tssKey: string, factorPub: TkeyPoint, newTSSIndex?: TssShareType): Promise<void>;
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

  /**
   * This option is used to specify the url path where user will be
   * redirected after login. Redirect Uri for OAuth is baseUrl/redirectPathName.
   *
   *
   * @defaultValue redirect
   *
   * @remarks
   * At verifier's interface (where you obtain client id), please use baseUrl/redirectPathName
   * as the redirect_uri
   *
   * Torus Direct SDK installs a service worker relative to baseUrl to capture
   * the auth redirect at `redirectPathName` path.
   *
   * For ex: While using serviceworker if `baseUrl` is "http://localhost:3000/serviceworker" and
   * `redirectPathName` is 'redirect' (which is default)
   * then user will be redirected to http://localhost:3000/serviceworker/redirect page after login
   * where service worker will capture the results and send it back to original window where login
   * was initiated.
   *
   * For browsers where service workers are not supported or if you wish to not use
   * service workers,create and serve redirect page (i.e redirect.html file which is
   * available in serviceworker folder of this package)
   *
   * If you are using redirect uxMode, you can get the results directly on your `redirectPathName`
   * path using `getRedirectResult` function.
   *
   * For ex: if baseUrl is "http://localhost:3000" and `redirectPathName` is 'auth'
   * then user will be redirected to http://localhost:3000/auth page after login
   * where you can get login result by calling `getRedirectResult` on redirected page mount.
   *
   * Please refer to examples https://github.com/torusresearch/customauth/tree/master/examples
   * for more understanding.
   *
   */
  redirectPathName?: string;
}

export type Web3AuthOptionsWithDefaults = Required<Web3AuthOptions>;

export type FactorKeyCloudMetadata = {
  share: ShareStore;
  // tssShare: BN;
  // tssIndex: number;
};

export interface SessionData {
  oAuthKey: string;
  factorKey: string;
  tssShareIndex: number;
  tssPubKey: string;
  signatures: string[];
  userInfo: UserInfo;
}

export interface TkeyLocalStoreData {
  factorKey: string;
}
