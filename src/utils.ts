import { getPubKeyPoint, Point, Point as TkeyPoint, randomSelection } from "@tkey-mpc/common-types";
import ThresholdKey from "@tkey-mpc/core";
import { generatePrivate } from "@toruslabs/eccrypto";
import { keccak256 } from "@toruslabs/torus.js";
import BN from "bn.js";

import { SCALAR_LEN, VALID_SHARE_INDICES as VALID_TSS_INDICES } from "./constants";

export const generateFactorKey = (): { private: BN; pub: TkeyPoint } => {
  const factorKey = new BN(generatePrivate());
  const factorPub = getPubKeyPoint(factorKey);
  return { private: factorKey, pub: factorPub };
};

export const generateTSSEndpoints = (tssNodeEndpoints: string[], parties: number, clientIndex: number, nodeIndexes: number[]) => {
  const endpoints: string[] = [];
  const tssWSEndpoints: string[] = [];
  const partyIndexes: number[] = [];

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
    }
  }
  return { endpoints, tssWSEndpoints, partyIndexes };
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
  return JSON.parse(window.atob(base64 || ""));
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
async function refreshTssShares(
  tKey: ThresholdKey,
  factorPubs: Point[],
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

export async function addFactorAndRefresh(
  tKey: ThresholdKey,
  newFactorPub: Point,
  newFactorTSSIndex: number,
  factorKeyForExistingTSSShare: BN,
  signatures: string[]
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

  await refreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, factorKeyForExistingTSSShare, signatures);
}

export async function deleteFactorAndRefresh(tKey: ThresholdKey, factorPubToDelete: Point, factorKeyForExistingTSSShare: BN, signatures: string[]) {
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

  await refreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, factorKeyForExistingTSSShare, signatures);
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
