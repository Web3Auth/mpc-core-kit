'use strict';

var commonTypes = require('@tkey/common-types');
var core = require('@tkey/core');
var tss = require('@tkey/tss');
var openloginUtils = require('@toruslabs/openlogin-utils');
var torus_js = require('@toruslabs/torus.js');
var BN = require('bn.js');
var elliptic = require('elliptic');
var loglevel = require('loglevel');
var constants = require('./constants.js');

const ed25519 = () => {
  return new elliptic.eddsa("ed25519");
};

/**
 * Secure PRNG. Uses `crypto.getRandomValues`, which defers to OS.
 */
function randomBytes(bytesLength = 32) {
  // We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
  const crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : undefined;
  if (crypto && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}
function generateEd25519Seed() {
  return Buffer.from(randomBytes(32));
}
const generateFactorKey = () => {
  const keyPair = tss.factorKeyCurve.genKeyPair();
  const pub = commonTypes.Point.fromElliptic(keyPair.getPublic());
  return {
    private: keyPair.getPrivate(),
    pub
  };
};
const generateTSSEndpoints = (tssNodeEndpoints, parties, clientIndex, nodeIndexes) => {
  const endpoints = [];
  const tssWSEndpoints = [];
  const partyIndexes = [];
  const nodeIndexesReturned = [];
  for (let i = 0; i < parties; i++) {
    partyIndexes.push(i);
    if (i === clientIndex) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      endpoints.push(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tssWSEndpoints.push(null);
    } else {
      const targetNodeIndex = nodeIndexes[i] - 1;
      endpoints.push(tssNodeEndpoints[targetNodeIndex]);
      tssWSEndpoints.push(new URL(tssNodeEndpoints[targetNodeIndex]).origin);
      nodeIndexesReturned.push(nodeIndexes[i]);
    }
  }
  return {
    endpoints,
    tssWSEndpoints,
    partyIndexes,
    nodeIndexesReturned
  };
};
async function storageAvailable(storage) {
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
function parseToken(token) {
  const payload = token.split(".")[1];
  return JSON.parse(openloginUtils.safeatob(payload));
}
const getHashedPrivateKey = (postboxKey, clientId) => {
  const uid = `${postboxKey}_${clientId}`;
  let hashUid = torus_js.keccak256(Buffer.from(uid, "utf8"));
  hashUid = hashUid.replace("0x", "");
  return new BN(hashUid, "hex");
};

/**
 * Converts an elliptic curve scalar represented by a BN to a byte buffer in SEC1
 * format (i.e., padded to maximum length).
 * @param s - The scalar of type BN.
 * @returns The SEC1 encoded representation of the scalar.
 */
function scalarBNToBufferSEC1(s) {
  return s.toArrayLike(Buffer, "be", constants.SCALAR_LEN);
}
function sampleEndpoints(endpoints, n) {
  if (n > endpoints.length) {
    throw new Error("Invalid number of endpoints");
  }
  const shuffledEndpoints = endpoints.slice().sort(() => Math.random() - 0.5);
  return shuffledEndpoints.slice(0, n).sort((a, b) => a.index - b.index);
}
function fraction(curve, nom, denom) {
  return nom.mul(denom.invm(curve.n)).umod(curve.n);
}
function lagrangeCoefficient(curve, xCoords, targetCoeff, targetX) {
  return xCoords.filter((_, i) => i !== targetCoeff).reduce((prev, cur) => {
    const frac = fraction(curve, targetX.sub(cur), xCoords[targetCoeff].sub(cur));
    return prev.mul(frac).umod(curve.n);
  }, new BN(1));
}
function lagrangeCoefficients(curve, xCoords, targetX) {
  const xCoordsBN = xCoords.map(i => new BN(i));
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
function deriveShareCoefficients(ec, serverXCoords, targetClientXCoord, sourceClientXCoord = CLIENT_XCOORD_L1) {
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
    clientCoefficient
  };
}
function generateSessionNonce() {
  return torus_js.keccak256(Buffer.from(core.generatePrivateBN().toString("hex") + Date.now(), "utf8"));
}
function getSessionId(verifier, verifierId, tssTag, tssNonce, sessionNonce) {
  return `${verifier}${constants.DELIMITERS.Delimiter1}${verifierId}${constants.DELIMITERS.Delimiter2}${tssTag}${constants.DELIMITERS.Delimiter3}${tssNonce}${constants.DELIMITERS.Delimiter4}${sessionNonce}`;
}
function sigToRSV(sig) {
  if (sig.length !== 65) {
    throw new Error(`Invalid signature length: expected 65, got ${sig.length}`);
  }
  return {
    r: sig.subarray(0, 32),
    s: sig.subarray(32, 64),
    v: sig[64]
  };
}
function makeEthereumSigner(kit) {
  if (kit.keyType !== commonTypes.KeyType.secp256k1) {
    throw new Error(`Invalid key type: expected secp256k1, got ${kit.keyType}`);
  }
  return {
    sign: async msgHash => {
      const sig = await kit.sign(msgHash, true);
      return sigToRSV(sig);
    },
    getPublic: async () => {
      const pk = commonTypes.Point.fromSEC1(commonTypes.secp256k1, kit.getPubKey().toString("hex"));
      return pk.toSEC1(commonTypes.secp256k1).subarray(1);
    }
  };
}
const log = loglevel.getLogger("mpc-core-kit");
log.disableAll();

exports.deriveShareCoefficients = deriveShareCoefficients;
exports.ed25519 = ed25519;
exports.fraction = fraction;
exports.generateEd25519Seed = generateEd25519Seed;
exports.generateFactorKey = generateFactorKey;
exports.generateSessionNonce = generateSessionNonce;
exports.generateTSSEndpoints = generateTSSEndpoints;
exports.getHashedPrivateKey = getHashedPrivateKey;
exports.getSessionId = getSessionId;
exports.lagrangeCoefficient = lagrangeCoefficient;
exports.lagrangeCoefficients = lagrangeCoefficients;
exports.log = log;
exports.makeEthereumSigner = makeEthereumSigner;
exports.parseToken = parseToken;
exports.randomBytes = randomBytes;
exports.sampleEndpoints = sampleEndpoints;
exports.scalarBNToBufferSEC1 = scalarBNToBufferSEC1;
exports.sigToRSV = sigToRSV;
exports.storageAvailable = storageAvailable;
