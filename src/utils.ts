import { KeyType, Point, Point as TkeyPoint, secp256k1 } from "@tkey/common-types";
import { generatePrivateBN } from "@tkey/core";
import { factorKeyCurve } from "@tkey/tss";
import { EllipticCurve } from "@toruslabs/elliptic-wrapper";
import { safeatob } from "@toruslabs/openlogin-utils";
import { keccak256 } from "@toruslabs/torus.js";
import BN from "bn.js";
import { eddsa as EDDSA } from "elliptic";
import loglevel from "loglevel";

import { DELIMITERS, SCALAR_LEN } from "./constants";
import { CoreKitSigner, EthereumSigner, IAsyncStorage, IStorage } from "./interfaces";

export const ed25519 = () => {
  return new EDDSA("ed25519");
};

/**
 * Secure PRNG. Uses `crypto.getRandomValues`, which defers to OS.
 */
export function randomBytes(bytesLength = 32): Uint8Array {
  // We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
  const crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : undefined;

  if (crypto && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}

export function generateEd25519Seed() {
  return Buffer.from(randomBytes(32));
}

export const generateFactorKey = (): { private: BN; pub: TkeyPoint } => {
  const keyPair = factorKeyCurve.genKeyPair();
  const pub = Point.fromElliptic(keyPair.getPublic());
  return { private: keyPair.getPrivate(), pub };
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

export async function storageAvailable(storage: IStorage | IAsyncStorage): Promise<boolean> {
  try {
    const x = "__storage_test__";
    const rand = Math.random().toString();
    await storage.setItem(x, rand);

    const value = await storage.getItem(rand);
    if (value !== rand) {
      throw new Error("Value mismatch");
    }
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

const SERVER_XCOORD_L1 = 1;
const CLIENT_XCOORD_L1 = 2;

/**
 * Derive share coefficients for client and servers.
 *
 * @param curve - The curve to be used.
 * @param serverXCoords - The source and target x-coordinates of the selected
 * servers.
 * @param targetClientXCoord - The target x-coordinate of the client.
 * @param sourceClientXCoord - The source x-coordinate of the client in the L1
 * hierarchy.
 * @returns - The share coefficients for the client and the servers.
 */
export function deriveShareCoefficients(
  ec: EllipticCurve,
  serverXCoords: number[],
  targetClientXCoord: number,
  sourceClientXCoord: number = CLIENT_XCOORD_L1
): { serverCoefficients: BN[]; clientCoefficient: BN } {
  const l1Coefficients = lagrangeCoefficients(ec, [SERVER_XCOORD_L1, sourceClientXCoord], 0);
  const l2Coefficients = lagrangeCoefficients(ec, serverXCoords, 0);

  if (serverXCoords.includes(targetClientXCoord)) {
    throw new Error(`Invalid server x-coordinates: overlapping with client x-coordinate: ${serverXCoords} ${targetClientXCoord}`);
  }

  const targetCoefficients = lagrangeCoefficients(ec, [targetClientXCoord, ...serverXCoords], 0);

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
  return keccak256(Buffer.from(generatePrivateBN().toString("hex") + Date.now(), "utf8"));
}

export function getSessionId(verifier: string, verifierId: string, tssTag: string, tssNonce: number, sessionNonce: string) {
  return `${verifier}${DELIMITERS.Delimiter1}${verifierId}${DELIMITERS.Delimiter2}${tssTag}${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}${sessionNonce}`;
}

export function sigToRSV(sig: Buffer) {
  if (sig.length !== 65) {
    throw new Error(`Invalid signature length: expected 65, got ${sig.length}`);
  }

  return { r: sig.subarray(0, 32), s: sig.subarray(32, 64), v: sig[64] };
}

export function makeEthereumSigner(kit: CoreKitSigner): EthereumSigner {
  if (kit.keyType !== KeyType.secp256k1) {
    throw new Error(`Invalid key type: expected secp256k1, got ${kit.keyType}`);
  }
  return {
    sign: async (msgHash: Buffer) => {
      const sig = await kit.sign(msgHash, { hashed: true });
      return sigToRSV(sig);
    },
    getPublic: async () => {
      const pk = Point.fromSEC1(secp256k1, kit.getPubKey().toString("hex"));
      return pk.toSEC1(secp256k1).subarray(1);
    },
  };
}

export const log = loglevel.getLogger("mpc-core-kit");
log.disableAll();
