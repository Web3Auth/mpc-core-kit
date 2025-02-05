import { KeyType, Point as TkeyPoint, ShareDescriptionMap } from "@tkey/common-types";
import { TKeyTSS, TSSTorusServiceProvider } from "@tkey/tss";
import { WEB3AUTH_SIG_TYPE } from "@toruslabs/constants";
import type {
  AGGREGATE_VERIFIER_TYPE,
  ExtraParams,
  LoginWindowResponse,
  PasskeyExtraParams,
  SubVerifierDetails,
  TorusAggregateLoginResponse,
  TorusLoginResponse,
  TorusVerifierResponse,
  UX_MODE_TYPE,
} from "@toruslabs/customauth";
import { TorusKey } from "@toruslabs/torus.js";
import { Client } from "@toruslabs/tss-client";
// TODO: move the types to a base class for both dkls and frost in future
import type { tssLib as TssDklsLib } from "@toruslabs/tss-dkls-lib";
import type { tssLib as TssFrostLibEd25519 } from "@toruslabs/tss-frost-lib";
import type { tssLib as TssFrostLibBip340 } from "@toruslabs/tss-frost-lib-bip340";
import { SafeEventEmitter } from "@web3auth/auth";
import BN from "bn.js";

import { FactorKeyTypeShareDescription, TssShareType, USER_PATH, WEB3AUTH_NETWORK } from "./constants";
import { ISessionSigGenerator } from "./plugins/ISessionSigGenerator";

export type CoreKitMode = UX_MODE_TYPE | "nodejs" | "react-native";

export type V4TSSLibType = typeof TssDklsLib | typeof TssFrostLibEd25519 | typeof TssFrostLibBip340;
export type TssLibType = typeof TssDklsLib | typeof TssFrostLibEd25519 | typeof TssFrostLibBip340;

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

export type OAuthLoginParams = (SubVerifierDetailsParams | AggregateVerifierLoginParams) & {
  /**
   * Key to import key into Tss during first time login.
   */
  importTssKey?: string;

  /**
   * For new users, use SFA key if user was registered with SFA before.
   * Useful when you created the user with SFA before and now want to convert it to TSS.
   */
  registerExistingSFAKey?: boolean;
};
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

export interface JWTLoginParams {
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

  /**
   * For new users, use SFA key if user was registered with SFA before.
   * Useful when you created the user with SFA before and now want to convert it to TSS.
   */
  registerExistingSFAKey?: boolean;

  /**
   * Number of TSS public keys to prefetch. For the best performance, set it to
   * the number of factors you want to create. Set it to 0 for an existing user.
   * Default is 1, maximum is 3.
   */
  prefetchTssPublicKeys?: number;
}

export interface Web3AuthState {
  postBoxKey?: string;
  signatures?: string[];
  postboxKeyNodeIndexes?: number[];
  userInfo?: UserInfo;
  tssShareIndex?: number;
  tssPubKey?: Buffer;
  accountIndex: number;
  factorKey?: BN;
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
  tssLib: TssLibType;

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
   * @defaultValue false
   * disable session manager creation
   * signatures from web3auth newtorks will still expired after sessionTime if session manager is disabled
   */
  disableSessionManager?: boolean;

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

  /**
   * Set this flag to false to generate keys on client side
   * by default keys are generated on using dkg protocol on a distributed network
   * Note: This option is not supported for ed25519 key type
   * @defaultValue `true`
   */
  useDKG?: boolean;

  /**
   * @defaultValue `false` for secp256k1 and `true` for ed25519
   * Set this flag to true to use the client generated key for signing
   * Note: This option is set to true for ed25519 key type by default to ensure ed25519 mpc key  seed exportablity.
   * The seed thn can be used for importing user's key other wallets like phantom etc
   * If you set this flag to false for ed25519 key type, you will not be able to export the seed for ed25519 keys and
   * only scalar will be exported, scalar can be used for signing outside of this sdk but not for importing the key in other wallets.
   */
  useClientGeneratedTSSKey?: boolean;
}
export type Web3AuthOptionsWithDefaults = Required<Web3AuthOptions>;

export interface IMPCContext {
  stateEmitter: SafeEventEmitter;
  config: Web3AuthOptionsWithDefaults;
  status: COREKIT_STATUS;
  state: Web3AuthState;
  torusSp: TSSTorusServiceProvider | null;
  updateState: (newState: Partial<Web3AuthState>) => void;
  getUserInfo: () => UserInfo;
  setupTkey: (params?: {
    providedImportKey?: string;
    sfaLoginResponse?: TorusKey | TorusLoginResponse | TorusAggregateLoginResponse;
    userInfo?: UserInfo;
    importingSFAKey?: boolean;
    persistSessionSigs?: boolean;
  }) => Promise<void>;
  setCustomSessionSigGenerator: (sessionSigGenerator: ISessionSigGenerator) => void;
}

export interface Secp256k1PrecomputedClient {
  client: Client;
  serverCoeffs: Record<string, string>;
  signatures: string[];
}

export interface ICoreKit {
  /**
   * The tKey instance, if initialized.
   * TKey is the core module on which this wrapper SDK sits for easy integration.
   **/
  tKey: TKeyTSS | null;

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
   * Login using OAuth flow and initialize all relevant components.
   * @param loginParams - Parameters for OAuth-based Login.
   */
  loginWithOAuth(loginParams: OAuthLoginParams): Promise<void>;

  /**
   * Login using JWT Token and initialize all relevant components.
   * @param loginParams - Parameters for JWT-based Login.
   */
  loginWithJWT(loginParams: JWTLoginParams): Promise<void>;

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

  getSessionSignatures(): Promise<string[]>;

  setCustomSessionSigGenerator(sessionSigGenerator: ISessionSigGenerator): void;

  /**
   * Commit the changes made to the user's account when in manual sync mode.
   */
  commitChanges(): Promise<void>;

  /**
   * Create a signature for the given data.
   *
   * Options:
   * - hashed: The data is already hashed. Do not hash again. Only works for ecdsa-secp256k1.
   * - secp256k1Precompute: Provide a precomputed client for faster signing. Only works for ecdsa-secp256k1.
   * - keyTweak: Provide a bip340 key tweak. Only works for bip340.
   */
  sign(
    data: Buffer,
    opts?: {
      hashed?: boolean;
      secp256k1Precompute?: Secp256k1PrecomputedClient;
      keyTweak?: BN;
    }
  ): Promise<Buffer>;

  /**
   * WARNING: Use with caution. This will export the private signing key.
   *
   * Exports the private key scalar for the current account index.
   *
   * For keytype ed25519, consider using _UNSAFE_exportTssEd25519Seed.
   */
  _UNSAFE_exportTssKey(): Promise<string>;

  /**
   * WARNING: Use with caution. This will export the private signing key.
   *
   * Attempts to export the ed25519 private key seed. Only works if import key
   * flow has been used.
   */
  _UNSAFE_exportTssEd25519Seed(): Promise<Buffer>;
}

export interface SessionData {
  /**
   * @deprecated Use `postBoxKey` instead.
   */
  oAuthKey?: string;
  postBoxKey?: string;
  postboxKeyNodeIndexes?: number[];
  factorKey: string;
  tssShareIndex: number;
  tssPubKey: string;
  signatures: string[];
  userInfo: UserInfo;
}

export interface TkeyLocalStoreData {
  factorKey: string;
}

export type SigType = WEB3AUTH_SIG_TYPE;

export interface CoreKitSigner {
  keyType: KeyType;
  sigType: SigType;
  sign(data: Buffer, opts?: { hashed?: boolean }): Promise<Buffer>;
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

export type StateEmitterEvents = {
  LOGOUT: () => void;
};
