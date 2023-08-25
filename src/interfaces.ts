import { KeyDetails, ShareStore } from "@tkey-mpc/common-types";
import ThresholdKey from "@tkey-mpc/core";
import type { AGGREGATE_VERIFIER_TYPE, LoginWindowResponse, SubVerifierDetails, TorusVerifierResponse, UX_MODE_TYPE } from "@toruslabs/customauth";
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

export interface IWeb3Auth {
  provider: SafeEventEmitterProvider | null;
  tkeyMetadataKey: BN | null;
  tKey: ThresholdKey;
  init(): void;
  connect(loginParams: LoginParams, factorKey?: BN): Promise<SafeEventEmitterProvider | null>;
  handleRedirectResult(): Promise<SafeEventEmitterProvider | null>;
  getUserInfo(): UserInfo;
  generateFactor(
    shareCategory: ShareType,
    shareDescription?: FactorKeyTypeShareDescription,
    additionalMetadata?: Record<string, string>,
    factorKey?: BN
  ): Promise<BN>;
  importFactor(factorKey: BN): Promise<void>;
  deleteFactor(factorPub: string): Promise<void>; // TODO: implement delete share
  getKeyDetails(): KeyDetails;
  commitChanges(): Promise<void>;
  logout(): Promise<void>;
  CRITICAL_resetAccount(): Promise<void>;
}

export type WEB3AUTH_NETWORK_TYPE = (typeof WEB3AUTH_NETWORK)[keyof typeof WEB3AUTH_NETWORK];

export type USER_PATH_TYPE = (typeof USER_PATH)[keyof typeof USER_PATH];

export interface Web3AuthOptions {
  web3AuthClientId: string;

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
  tssShare2?: BN;
  tssShare2Index?: number;
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
