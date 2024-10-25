import { FactorEnc, Point } from "@tkey/common-types";
import { PointHex } from "@toruslabs/tss-client";

export interface IRemoteClientState {
  remoteFactorPub: string;
  remoteClientUrl: string;
  remoteClientToken: string;
  metadataShare: string;
  tssShareIndex: number;
}

export interface refreshRemoteTssType {
  // from client
  factorEnc: FactorEnc;

  factorPubs: Point[];
  targetIndexes: number[];
  verifierNameVerifierId: string;

  tssTag: string;
  tssCommits: Point[];
  tssNonce: number;
  newTSSServerPub: Point;
  // nodeIndexes : number[],

  serverOpts: {
    serverEndpoints: string[];
    serverPubKeys: PointHex[];
    serverThreshold: number;
    selectedServers: number[];
    authSignatures: string[];
  };
}
export interface RefreshRemoteTssReturnType {
  tssTag: string;
  tssNonce: number;
  tssPolyCommits: Point[];
  factorPubs: Point[];
  factorEncs: {
    [factorPubID: string]: FactorEnc;
  };
}
