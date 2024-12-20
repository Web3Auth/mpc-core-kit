import { FactorEnc, Point, ShareDescriptionMap } from "@tkey/common-types";
import { PointHex } from "@toruslabs/tss-client";
import { SafeEventEmitter } from "@web3auth/auth";

import { COREKIT_STATUS, CreateFactorParams, WEB3AUTH_NETWORK_TYPE } from "../interfaces";

export type SupportedCurve = "secp256k1" | "ed25519";

export type ICustomFrostSignParams = {
  sessionId: string;
  signatures: string[];
  tssCommits: PointHex[];
  factorEnc: FactorEnc;
  tssPubKeyHex: string;
  curve: SupportedCurve;

  serverXCoords: number[];
  clientXCoord: number;
  serverCoefficients: string[];
  clientCoefficient: string;
  serverURLs: string[];
};

export interface ICustomDklsSignParams {
  sessionId: string;
  signatures: string[];
  tssCommits: PointHex[];
  factorEnc: FactorEnc;
  tssPubKeyHex: string;
  curve: SupportedCurve;

  participatingServerDKGIndexes: number[];
  clientIndex: number;
  tssNonce: string;
  accountNonce: string;

  endpoints: string[];
  tssWSEndpoints: string[];
  partyIndexes: number[];
}

export interface ICustomDKLSSign {
  sign: (params: ICustomDklsSignParams, msgHash: Uint8Array) => Promise<{ v: number; r: Uint8Array; s: Uint8Array }>;
}

export interface ICustomFrostSign {
  sign: (params: ICustomFrostSignParams, msgHash: Uint8Array) => Promise<Uint8Array>;
}

export interface IRemoteClientState {
  remoteFactorPub: string;
  metadataShare: string;
  tssShareIndex: number;
}

export interface IRemoteSignerContext {
  status: COREKIT_STATUS;
  stateEmitter: SafeEventEmitter;
  setupRemoteSigning(params: Omit<IRemoteClientState, "tssShareIndex">, rehydrate?: boolean): Promise<void>;
  createFactor(createFactorParams: CreateFactorParams): Promise<string>;
  inputFactorKey(factorKey: string): Promise<void>;
  deleteFactor(factorPub: Point, factorKey?: string): Promise<void>;
  getKeyDetails(): Record<string, unknown> & { shareDescriptions: ShareDescriptionMap };
  getMetadataKey(): string | undefined;
  getMetadataPublicKey(): string | undefined;
  getWeb3AuthNetwork(): WEB3AUTH_NETWORK_TYPE;

  // Added new methods
  setCustomDKLSSign(customDKLSSign: ICustomDKLSSign): void;
  setCustomFrostSign(customDKLSSign: ICustomFrostSign): void;
}
