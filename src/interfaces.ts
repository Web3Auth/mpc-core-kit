import { KeyType, Point as TkeyPoint, ShareDescriptionMap } from "@tkey/common-types";
import { TKeyTSS } from "@tkey/tss";
import type {
  AGGREGATE_VERIFIER_TYPE,
  ExtraParams,
  LoginWindowResponse,
  PasskeyExtraParams,
  SubVerifierDetails,
  TorusVerifierResponse,
  UX_MODE_TYPE,
} from "@toruslabs/customauth";
import { CustomChainConfig } from "@web3auth/base";
import BN from "bn.js";

import { FactorKeyTypeShareDescription, TssShareType, USER_PATH, WEB3AUTH_NETWORK } from "./constants";

export type CoreKitMode = UX_MODE_TYPE | "nodejs" | "react-native";

export interface IStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface IAsyncStorage {
  async?: boolean;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type SupportedStorageType = "local" | "session" | "memory" | IStorage;

export type TssLib = { keyType: string; lib: unknown };

export interface InitParams {
  /**
   * @defaultValue `true`
   * handle the redirect result during init()
   */
  handleRedirectResult: boolean;
  /**
   * @defaultValue `true`
   * rehydrate the session during init()
   */
  rehydrate?: boolean;
}

export interface BaseLoginParams {
  // offset in seconds
  serverTimeOffset?: number;
}

export interface SubVerifierDetailsParams extends BaseLoginParams {
  subVerifierDetails: SubVerifierDetails;
}

export interface AggregateVerifierLoginParams extends BaseLoginParams {
  aggregateVerifierIdentifier: string;
  subVerifierDetailsArray: SubVerifierDetails[];
  aggregateVerifierType?: AGGREGATE_VERIFIER_TYPE;
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

export type MPCKeyDetails = {
  metadataPubKey: TkeyPoint;
  threshold: number;
  requiredFactors: number;
  totalFactors: number;
  shareDescriptions: ShareDescriptionMap;
  keyType: KeyType;
  tssPubKey?: TkeyPoint;
};

export type OauthLoginParams = (SubVerifierDetailsParams | AggregateVerifierLoginParams) & { importTssKey?: string };
export type UserInfo = TorusVerifierResponse & LoginWindowResponse;

export interface EnableMFAParams {
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

export interface CreateFactorParams extends EnableMFAParams {
  /**
   * Setting the Type of Share - Device or Recovery.
   **/
  shareType: TssShareType;
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
  extraVerifierParams?: PasskeyExtraParams;

  /**
   * Any additional parameter (key value pair) you'd like to pass to the login function.
   */
  additionalParams?: ExtraParams;

  /**
   * Key to import key into Tss during first time login.
   */
  importTssKey?: string;
}

export interface Web3AuthState {
  // deprecated soon
  oAuthKey?: string;
  postBoxKey?: string;
  signatures?: string[];
  userInfo?: UserInfo;
  tssShareIndex?: number;
  tssPubKey?: Buffer;
  accountIndex: number;
  factorKey?: BN;
}

export interface ICoreKit {
  /**
   * The tKey instance, if initialized.
   * TKey is the core module on which this wrapper SDK sits for easy integration.
   **/
  tKey: TKeyTSS | null;

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
   * @param initParams - Contains flag for handleRedirectResult. Default is true.
   */
  init(initParams?: InitParams): Promise<void>;

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
   * Enable MFA for the user. Deletes the Cloud factor and generates a new
   * factor key and a backup factor key. Recommended for Non Custodial Flow.
   * Stores the factor key in browser storage and returns the backup factor key.
   *
   * ** NOTE before enableMFA, you will need to commitChanges if manualSync is true.
   *
   * @param enableMFAParams - Parameters for recovery factor for MFA.
   * @param recoveryFactor - Default is true. If false, recovery factor will NOT be created.
   * @returns The backup factor key if if recoveryFacort is true else empty string.
   */
  enableMFA(enableMFAParams: EnableMFAParams, recoveryFactor?: boolean): Promise<string>;

  /**
   * Second step for login where the user inputs their factor key.
   * @param factorKey - A BN used for encrypting your Device/ Recovery TSS Key
   * Share. You can generate it using `generateFactorKey()` function or use an
   * existing one.
   */
  inputFactorKey(factorKey: BN): Promise<void>;

  /**
   * Returns the current Factor Key and TssShareType in MPC Core Kit State
   **/
  getCurrentFactorKey(): IFactorKey;

  /**
   * Creates a new factor for authentication. Generates and returns a new factor
   * key if no factor key is provided in `params`.
   * @param createFactorParams - Parameters for creating a new factor.
   * @returns The factor key.
   */
  createFactor(createFactorParams: CreateFactorParams): Promise<string>;

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
  getKeyDetails(): MPCKeyDetails;

  /**
   * Commit the changes made to the user's account when in manual sync mode.
   */
  commitChanges(): Promise<void>;

  /**
   * Export the user's current TSS MPC account as a private key
   */
  _UNSAFE_exportTssKey(): Promise<string>;
}

export type WEB3AUTH_NETWORK_TYPE = (typeof WEB3AUTH_NETWORK)[keyof typeof WEB3AUTH_NETWORK];

export type USER_PATH_TYPE = (typeof USER_PATH)[keyof typeof USER_PATH];

export interface Web3AuthOptions {
  /**
   * The Web3Auth Client ID for your application. Find one at https://dashboard.web3auth.io
   */
  web3AuthClientId: string;

  /**
   * The threshold signing library to use.
   */
  tssLib: TssLib;

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
   * @defaultValue `'sapphire_mainnet'`
   */
  web3AuthNetwork?: WEB3AUTH_NETWORK_TYPE;

  /**
   *  storage for mpc-core-kit's local state.
   *  storage replaces previous' storageKey and asyncStorage options.
   *
   *  Migration from storageKey and asyncStorage to storage guide.
   *
   *  For StorageKey, please replace
   *  - undefined with localStorage
   *  - "local" with localStorage
   *  - "session" with sessionStorage
   *  - "memory" with new MemoryStorage()
   *
   *  For asyncStorage, provide instance of IAsyncStorage.
   *
   */
  storage: IAsyncStorage | IStorage;

  /**
   * @defaultValue 86400
   */
  sessionTime?: number;

  /**
   * @defaultValue `'POPUP'`
   */
  uxMode?: CoreKitMode;

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
   * @defaultValue `"redirect"`
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

  /**
   * @defaultValue `false`
   * Disables the cloud factor key, enabling the one key semi custodial flow.
   * Recommended for Non Custodial Flow.
   */
  disableHashedFactorKey?: boolean;

  /**
   * @defaultValue `Web3AuthOptions.web3AuthClientId`
   * Overwrites the default value ( clientId ) used as nonce for hashing the hash factor key.
   *
   * If you want to aggregate the mfa status of client id 1 and client id 2  apps
   * set hashedFactorNonce to some common clientID, which can be either client id 1 or client id 2 or any other unique string
   * #PR 72
   * Do not use this unless you know what you are doing.
   */
  hashedFactorNonce?: string;

  serverTimeOffset?: number;
}

export type Web3AuthOptionsWithDefaults = Required<Web3AuthOptions>;

export interface SessionData {
  oAuthKey?: string;
  postBoxKey?: string;
  factorKey: string;
  tssShareIndex: number;
  tssPubKey: string;
  signatures: string[];
  userInfo: UserInfo;
}

export interface TkeyLocalStoreData {
  factorKey: string;
}

export interface CoreKitSigner {
  keyType: KeyType;
  sign(data: Buffer, hashed?: boolean): Promise<Buffer>;
  getPubKey(): Buffer;
}

export interface EthSig {
  v: number;
  r: Buffer;
  s: Buffer;
}

export interface EthereumSigner {
  sign: (msgHash: Buffer) => Promise<EthSig>;
  getPublic: () => Promise<Buffer>;
}
