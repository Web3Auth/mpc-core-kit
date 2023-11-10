import { FactorEnc, getPubKeyPoint, Point as TkeyPoint, PointHex, randomSelection } from "@tkey-mpc/common-types";
import ThresholdKey from "@tkey-mpc/core";
import { generatePrivate } from "@toruslabs/eccrypto";
import { post } from "@toruslabs/http-helpers";
import { keccak256, StringifiedType } from "@toruslabs/torus.js";
import BN from "bn.js";

import { SCALAR_LEN, VALID_SHARE_INDICES as VALID_TSS_INDICES } from "./constants";
import { IRemoteClientState, UserInfo, Web3AuthState } from "./interfaces";

export const generateFactorKey = (): { private: BN; pub: TkeyPoint } => {
  const factorKey = new BN(generatePrivate());
  const factorPub = getPubKeyPoint(factorKey);
  return { private: factorKey, pub: factorPub };
};

export const generateTSSEndpoints = (tssNodeEndpoints: string[], parties: number, clientIndex: number, nodeIndexes: number[]) => {
  const endpoints: string[] = [];
  const tssWSEndpoints: string[] = [];
  const partyIndexes: number[] = [];
  const nodeIndexesReturned: number[] = [];

  for (let i = 0; i < parties; i++) {
    partyIndexes.push(i);
    if (i === clientIndex) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      endpoints.push(null as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tssWSEndpoints.push(null as any);
    } else {
      const targetNodeIndex = nodeIndexes[i] - 1;
      endpoints.push(tssNodeEndpoints[targetNodeIndex]);
      tssWSEndpoints.push(new URL(tssNodeEndpoints[targetNodeIndex]).origin);
      nodeIndexesReturned.push(nodeIndexes[i]);
    }
  }
  return { endpoints, tssWSEndpoints, partyIndexes, nodeIndexesReturned };
};

export function storageAvailable(type: string): boolean {
  let storage: Storage;
  try {
    if (type === "localStorage") storage = window.localStorage;
    else storage = window.sessionStorage;

    const x = "__storage_test__";
    storage.setItem(x, x);
    storage.removeItem(x);

    return true;
  } catch (error) {
    return false;
  }
}

// TODO think which conversion functions to keep and how to export them.

/**
 * Parses a JWT Token, without verifying the signature.
 * @param token - JWT Token
 * @returns Extracted JSON payload from the token
 */
export function parseToken(token: string) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace("-", "+").replace("_", "/");
  return JSON.parse(atob(base64 || ""));
}

/**
 * Refreshes TSS shares. Allows to change number of shares. New user shares are
 * only produced for the target indices.
 * @param tKey - Tkey instance to use.
 * @param factorPubs - Factor pub keys after refresh.
 * @param tssIndices - Target tss indices to generate new shares for.
 * @param factorKeyForExistingTSSShare - Factor key for existing TSS share.
 * @param signatures - Signatures for authentication against RSS servers.
 */
export async function refreshTssShares(
  tKey: ThresholdKey,
  factorPubs: TkeyPoint[],
  tssIndices: number[],
  factorKeyForExistingTSSShare: BN,
  signatures: string[],
  updateMetadata = false
) {
  const { tssShare, tssIndex } = await tKey.getTSSShare(factorKeyForExistingTSSShare);

  const rssNodeDetails = await tKey._getRssNodeDetails();
  const { serverEndpoints, serverPubKeys, serverThreshold } = rssNodeDetails;
  const randomSelectedServers = randomSelection(
    new Array(rssNodeDetails.serverEndpoints.length).fill(null).map((_, i) => i + 1),
    Math.ceil(rssNodeDetails.serverEndpoints.length / 2)
  );

  const verifierNameVerifierId = tKey.serviceProvider.getVerifierNameVerifierId();
  await tKey._refreshTSSShares(updateMetadata, tssShare, tssIndex, factorPubs, tssIndices, verifierNameVerifierId, {
    selectedServers: randomSelectedServers,
    serverEndpoints,
    serverPubKeys,
    serverThreshold,
    authSignatures: signatures,
  });
}

export interface refreshRemoteTssType {
  // from client
  factorEnc: FactorEnc;

  factorPubs: TkeyPoint[];
  targetIndexes: number[];
  verifierNameVerifierId: string;

  tssTag: string;
  tssCommits: TkeyPoint[];
  tssNonce: number;
  newTSSServerPub: TkeyPoint;
  // nodeIndexes : number[],

  serverOpts: {
    serverEndpoints: string[];
    serverPubKeys: PointHex[];
    serverThreshold: number;
    selectedServers: number[];
    authSignatures: string[];
  };
}
export interface refreshRemoteTssReturnType {
  tssTag: string;
  tssNonce: number;
  tssPolyCommits: TkeyPoint[];
  factorPubs: TkeyPoint[];
  factorEncs: {
    [factorPubID: string]: FactorEnc;
  };
}
/**
 * Refreshes TSS shares. Allows to change number of shares. New user shares are
 * only produced for the target indices.
 * @param tKey - Tkey instance to use.
 * @param factorPubs - Factor pub keys after refresh.
 * @param tssIndices - Target tss indices to generate new shares for.
 * @param remoteFactorPub - Factor Pub for remote share.
 * @param signatures - Signatures for authentication against RSS servers.
 */
export async function remoteRefreshTssShares(
  tKey: ThresholdKey,
  factorPubs: TkeyPoint[],
  tssIndices: number[],
  signatures: string[],
  remoteClient: IRemoteClientState,
  updateMetadata = false
) {
  // const { tssShare, tssIndex } = await tKey.getTSSShare(factorKeyForExistingTSSShare);

  const rssNodeDetails = await tKey._getRssNodeDetails();
  const { serverEndpoints, serverPubKeys, serverThreshold } = rssNodeDetails;
  let finalSelectedServers = randomSelection(
    new Array(rssNodeDetails.serverEndpoints.length).fill(null).map((_, i) => i + 1),
    Math.ceil(rssNodeDetails.serverEndpoints.length / 2)
  );

  const verifierNameVerifierId = tKey.serviceProvider.getVerifierNameVerifierId();

  const tssCommits = tKey.metadata.tssPolyCommits[tKey.tssTag];
  const tssNonce: number = tKey.metadata.tssNonces[tKey.tssTag] || 0;
  const { pubKey: newTSSServerPub, nodeIndexes } = await tKey.serviceProvider.getTSSPubKey(tKey.tssTag, tssNonce + 1);
  // move to pre-refresh
  if (nodeIndexes?.length > 0) {
    finalSelectedServers = nodeIndexes.slice(0, Math.min(serverEndpoints.length, nodeIndexes.length));
  }

  const factorEnc = tKey.getFactorEncs(TkeyPoint.fromCompressedPub(remoteClient.remoteFactorPub));

  const dataRequired = {
    factorEnc,
    factorPubs: factorPubs.map((pub) => pub.toJSON()),
    targetIndexes: tssIndices,
    verifierNameVerifierId,
    tssTag: tKey.tssTag,
    tssCommits: tssCommits.map((commit) => commit.toJSON()),
    tssNonce,
    newTSSServerPub: newTSSServerPub.toJSON(),
    serverOpts: {
      selectedServers: finalSelectedServers,
      serverEndpoints,
      serverPubKeys,
      serverThreshold,
      authSignatures: signatures,
    },
  };

  const result = (
    await post<{ data: refreshRemoteTssReturnType }>(
      `${remoteClient.remoteClientUrl}/api/mpc/refresh_tss`,
      { dataRequired },
      {
        headers: {
          Authorization: `Bearer ${remoteClient.remoteClientToken}`,
        },
      }
    )
  ).data;

  tKey.metadata.addTSSData({
    tssTag: result.tssTag,
    tssNonce: result.tssNonce,
    tssPolyCommits: result.tssPolyCommits.map((commit) => TkeyPoint.fromJSON(commit)),
    factorPubs: result.factorPubs.map((pub) => TkeyPoint.fromJSON(pub)),
    factorEncs: result.factorEncs,
  });

  if (updateMetadata) {
    await tKey._syncShareMetadata();
  }
}

export async function addFactorAndRefresh(
  tKey: ThresholdKey,
  newFactorPub: TkeyPoint,
  newFactorTSSIndex: number,
  factorKeyForExistingTSSShare: BN,
  signatures: string[],
  remoteClient?: IRemoteClientState
) {
  if (!tKey) {
    throw new Error("tkey does not exist, cannot add factor pub");
  }
  if (VALID_TSS_INDICES.indexOf(newFactorTSSIndex) === -1) {
    throw new Error(`invalid new share index: must be one of ${VALID_TSS_INDICES}`);
  }
  if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
    throw new Error(`factorPubs for tssTag = "${tKey.tssTag}" does not exist`);
  }

  const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag];
  const updatedFactorPubs = existingFactorPubs.concat([newFactorPub]);

  const existingTSSIndexes = existingFactorPubs.map((fb) => tKey.getFactorEncs(fb).tssIndex);
  const updatedTSSIndexes = existingTSSIndexes.concat([newFactorTSSIndex]);

  if (!remoteClient) {
    await refreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, factorKeyForExistingTSSShare, signatures);
  } else {
    await remoteRefreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, signatures, remoteClient);
  }
}

export async function deleteFactorAndRefresh(
  tKey: ThresholdKey,
  factorPubToDelete: TkeyPoint,
  factorKeyForExistingTSSShare: BN,
  signatures: string[],
  remoteClient?: IRemoteClientState
) {
  if (!tKey) {
    throw new Error("tkey does not exist, cannot add factor pub");
  }
  if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
    throw new Error(`factorPubs for tssTag = "${tKey.tssTag}" does not exist`);
  }

  const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag];
  const factorIndex = existingFactorPubs.findIndex((p) => p.x.eq(factorPubToDelete.x));
  if (factorIndex === -1) {
    throw new Error(`factorPub ${factorPubToDelete} does not exist`);
  }

  const updatedFactorPubs = existingFactorPubs.slice();
  updatedFactorPubs.splice(factorIndex, 1);
  const updatedTSSIndexes = updatedFactorPubs.map((fb) => tKey.getFactorEncs(fb).tssIndex);

  if (!remoteClient) {
    await refreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, factorKeyForExistingTSSShare, signatures);
  } else {
    await remoteRefreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, signatures, remoteClient);
  }
}

export const getHashedPrivateKey = (postboxKey: string, clientId: string): BN => {
  const uid = `${postboxKey}_${clientId}`;
  let hashUid = keccak256(Buffer.from(uid, "utf8"));
  hashUid = hashUid.replace("0x", "");
  return new BN(hashUid, "hex");
};

/**
 * Converts a elliptic curve scalar represented by a BN to a byte buffer in SEC1
 * format (i.e., padded to maximum length).
 * @param s - The scalar of type BN.
 * @returns The SEC1 encoded representation of the scalar.
 */
export function scalarBNToBufferSEC1(s: BN): Buffer {
  return s.toArrayLike(Buffer, "be", SCALAR_LEN);
}

export function Web3AuthStateFromJSON(result: StringifiedType): Web3AuthState {
  if (!result.factorKey) throw new Error("factorKey not found in JSON");
  if (!result.tssShareIndex) throw new Error("tssShareIndex not found in JSON");

  const factorKey = new BN(result.factorKey as string, "hex");
  const tssPubKey = Buffer.from(result.tssPubKey as Buffer);
  return {
    factorKey,
    oAuthKey: result.oAuthKey as string,
    tssShareIndex: parseInt(result.tssShareIndex as string),
    tssPubKey,
    signatures: result.signatures as string[],
    userInfo: result.userInfo as UserInfo,
  };
}
