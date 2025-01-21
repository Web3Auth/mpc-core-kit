import { FactorEnc } from "@tkey/common-types";
import { PointHex } from "@toruslabs/tss-client";
import BN from "bn.js";

import { Secp256k1PrecomputedClient } from "../../interfaces";

export type SupportedCurve = "secp256k1" | "ed25519";

export type IFrostSignParams = {
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

export interface IDklsSignParams {
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

export interface IDKLSSigner {
  sign: (params: IDklsSignParams, msgHash: Uint8Array) => Promise<{ v: number; r: Uint8Array; s: Uint8Array }>;
}

export interface IFrostSigner {
  sign: (params: IFrostSignParams, msgHash: Uint8Array) => Promise<Uint8Array>;
}

export interface IRemoteClientState {
  remoteFactorPub: string;
  metadataShare: string;
  tssShareIndex: number;
}

export interface ISigner {
  signECDSASecp256k1: (
    data: Buffer,
    hashed?: boolean,
    precomputedTssClient?: Secp256k1PrecomputedClient
  ) => Promise<{
    v: number;
    r: Buffer;
    s: Buffer;
  }>;
  signFrost: (data: Buffer, keyTweak?: BN) => Promise<Buffer>;
}
