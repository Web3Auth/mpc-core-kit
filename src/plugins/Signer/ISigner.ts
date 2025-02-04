import { FactorEnc } from "@tkey/common-types";
import { PointHex } from "@toruslabs/tss-client";
import BN from "bn.js";

import { Secp256k1PrecomputedClient } from "../../interfaces";

export type SupportedCurve = "secp256k1" | "ed25519";

export type IFrostSignConfig = {
  sessionId: string;
  signatures: string[];
  tssCommits: PointHex[];
  clientShareHex?: string;
  factorEnc?: FactorEnc;
  tssPubKeyHex: string;
  curve: SupportedCurve;

  serverXCoords: number[];
  clientXCoord: number;
  serverCoefficientsHex: string[];
  clientCoefficient: string;
  serverURLs: string[];
};

export interface IDklsSignConfig {
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

export interface IRemoteFactor {
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
