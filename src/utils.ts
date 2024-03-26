import { getPubKeyPoint, Point, Point as TkeyPoint } from "@tkey/common-types";
import { FACTOR_KEY_TYPE, randomSelection, TKeyTSS } from "@tkey/tss";
import { generatePrivate } from "@toruslabs/eccrypto";
import { EllipticCurve } from "@toruslabs/elliptic-wrapper";
import { safeatob } from "@toruslabs/openlogin-utils";
import { keccak256 } from "@toruslabs/torus.js";
import BN from "bn.js";

import { DELIMITERS, SCALAR_LEN, VALID_SHARE_INDICES as VALID_TSS_INDICES } from "./constants";

export const generateFactorKey = (): { private: BN; pub: TkeyPoint } => {
  const factorKey = new BN(generatePrivate());
  const factorPub = getPubKeyPoint(factorKey, FACTOR_KEY_TYPE);
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
  const payload = token.split(".")[1];
  return JSON.parse(safeatob(payload));
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
  tKey: TKeyTSS,
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
  tKey: TKeyTSS,
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

export async function deleteFactorAndRefresh(tKey: TKeyTSS, factorPubToDelete: Point, factorKeyForExistingTSSShare: BN, signatures: string[]) {
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
 * Converts an elliptic curve scalar represented by a BN to a byte buffer in SEC1
 * format (i.e., padded to maximum length).
 * @param s - The scalar of type BN.
 * @returns The SEC1 encoded representation of the scalar.
 */
export function scalarBNToBufferSEC1(s: BN): Buffer {
  return s.toArrayLike(Buffer, "be", SCALAR_LEN);
}

export interface ServerEndpoint {
  index: number;
  url: string;
}

export function sampleEndpoints(endpoints: ServerEndpoint[], n: number): ServerEndpoint[] {
  if (n > endpoints.length) {
    throw new Error("Invalid number of endpoints");
  }
  const shuffledEndpoints = endpoints.slice().sort(() => Math.random() - 0.5);
  return shuffledEndpoints.slice(0, n).sort((a, b) => a.index - b.index);
}

export function fraction(curve: EllipticCurve, nom: BN, denom: BN): BN {
  return nom.mul(denom.invm(curve.n)).umod(curve.n);
}

export function lagrangeCoefficient(curve: EllipticCurve, xCoords: BN[], targetCoeff: number, targetX: BN): BN {
  return xCoords
    .filter((_, i) => i !== targetCoeff)
    .reduce((prev, cur) => {
      const frac = fraction(curve, targetX.sub(cur), xCoords[targetCoeff].sub(cur));
      return prev.mul(frac).umod(curve.n);
    }, new BN(1));
}

export function lagrangeCoefficients(curve: EllipticCurve, xCoords: BN[] | number[], targetX: BN | number): BN[] {
  const xCoordsBN = xCoords.map((i) => new BN(i));
  const targetXBN = new BN(targetX);
  return xCoordsBN.map((_value, i) => lagrangeCoefficient(curve, xCoordsBN, i, targetXBN));
}

const SERVER_INDEX_L1 = 1;
const CLIENT_INDEX_L1 = 2;

/**
 * Derive share coefficients for client and servers.
 *
 * @param curve - The curve to be used.
 * @param serverXCoords - The x-coordinates of the selected servers.
 * @returns - The share coefficients for the client and the servers, and the
 * remapped x-coordinate of the client.
 */
export function deriveShareCoefficients(
  ec: EllipticCurve,
  serverXCoords: number[],
  clientXCoord: number
): { serverCoefficients: BN[]; clientCoefficient: BN } {
  const l1Coefficients = lagrangeCoefficients(ec, [SERVER_INDEX_L1, CLIENT_INDEX_L1], 0);
  const l2Coefficients = lagrangeCoefficients(ec, serverXCoords, 0);

  if (serverXCoords.includes(clientXCoord)) {
    throw new Error(`Invalid server x-coordinates: overlapping with client x-coordinate: ${serverXCoords} ${clientXCoord}`);
  }

  const targetCoefficients = lagrangeCoefficients(ec, [clientXCoord, ...serverXCoords], 0);

  // Derive server coefficients.
  const serverCoefficients = l2Coefficients.map((coeff, i) => fraction(ec, l1Coefficients[0].mul(coeff), targetCoefficients[i + 1]));

  // Derive client coefficient.
  const clientCoefficient = fraction(ec, l1Coefficients[1], targetCoefficients[0]);

  return {
    serverCoefficients,
    clientCoefficient,
  };
}

export function generateSessionNonce() {
  return keccak256(Buffer.from(generatePrivate().toString("hex") + Date.now(), "utf8"));
}

export function getSessionId(verifier: string, verifierId: string, tssTag: string, tssNonce: number, sessionNonce: string) {
  return `${verifier}${DELIMITERS.Delimiter1}${verifierId}${DELIMITERS.Delimiter2}${tssTag}${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}${sessionNonce}`;
}
