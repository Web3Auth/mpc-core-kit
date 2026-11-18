import "dotenv/config";

import { EllipticPoint, secp256k1 } from "@tkey/common-types";
import { tssLib } from "@toruslabs/tss-dkls-lib";
import BN from "bn.js";
import jwt, { Algorithm } from "jsonwebtoken";
import { tssLib as tssLibDKLS } from "@toruslabs/tss-dkls-lib";

import { IAsyncStorage, IStorage, parseToken, TssLibType, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";

export const criticalResetAccount = async (coreKitInstance: Web3AuthMPCCoreKit, manualSync: boolean): Promise<void> => {
  // This is a critical function that should only be used for testing purposes
  // Resetting your account means clearing all the metadata associated with it from the metadata server
  // The key details will be deleted from our server and you will not be able to recover your account
  if (!coreKitInstance) {
    throw new Error("coreKitInstance is not set");
  }

  if (coreKitInstance.tKey.secp256k1Key) {
    await coreKitInstance.commitChanges();
    await coreKitInstance.tKey.CRITICAL_deleteTkey();
  } else {
    await coreKitInstance.tKey.storageLayer.setMetadata({
      privKey: new BN(coreKitInstance.state.postBoxKey!, "hex"),
      input: { message: "KEY_NOT_FOUND" },
    });
    if (manualSync) {
      await coreKitInstance.tKey.syncLocalMetadataTransitions();
    }
  }
};

const alg: Algorithm = "ES256";

// Signing key for the `torus-test-health` verifier. Supplied via JWT_PRIVATE_KEY: a local .env file
// when running tests locally, a GitHub secret on CI. Never commit the key itself.
const getJwtPrivateKey = (): string => {
  const raw = process.env.JWT_PRIVATE_KEY;
  if (!raw) {
    throw new Error("JWT_PRIVATE_KEY is not set. See tests/README.md for how to provide the test signing key.");
  }

  // Secret stores and .env files commonly flatten the PEM onto one line with escaped newlines, and
  // quotes are easy to paste in by accident (GitHub stores the value verbatim, unlike dotenv).
  const key = raw.trim().replace(/^["']|["']$/g, "").trim().replace(/\\n/g, "\n");
  return key.includes("-----BEGIN") ? key : `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
};

// Optional: lets the verifier pick the right key out of a multi-key JWKS.
const getJwtKeyId = (): string | undefined => process.env.JWT_KEY_ID?.trim() || undefined;

// Test verifiers (torus-test-health) only accept identities in this domain - the nodes reject
// anything else with "test verifiers can only be used with test identities".
export const TEST_IDENTITY_DOMAIN = "@example.com";

export function toTestIdentity(email: string): string {
  return email.endsWith(TEST_IDENTITY_DOMAIN) ? email : `${email.split("@")[0]}${TEST_IDENTITY_DOMAIN}`;
}

export function stringGen(len: number) {
  let text = "";
  const charset = "abcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < len; i++) {
    text += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  return text;
}

export const mockLogin = async (email?: string) => {
  // if email is not passed generate a random email
  const identity = toTestIdentity(email || stringGen(10));

  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "torus-key-test",
    aud: "torus-key-test",
    name: identity,
    email: identity,
    scope: "email",
    iat,
    eat: iat + 120,
  };

  const keyid = getJwtKeyId();
  const algo = {
    expiresIn: 120,
    algorithm: alg,
    ...(keyid ? { keyid } : {}),
  };

  const token = jwt.sign(payload, getJwtPrivateKey(), algo);
  const idToken = token;
  const parsedToken = parseToken(idToken);
  return { idToken, parsedToken };
};

export type LoginFunc = (email: string) => Promise<{ idToken: string, parsedToken: any }>;

export const newCoreKitLogInInstance = async ({
  network,
  manualSync,
  email,
  storageInstance,
  importTssKey,
  registerExistingSFAKey,
  login,
}: {
  network: WEB3AUTH_NETWORK_TYPE;
  manualSync: boolean;
  email: string;
  storageInstance: IStorage | IAsyncStorage;
  tssLib?: TssLibType;
  importTssKey?: string;
  registerExistingSFAKey?: boolean;
  login?: LoginFunc;
}) => {
  const instance = new Web3AuthMPCCoreKit({
    web3AuthClientId: "torus-key-test",
    web3AuthNetwork: network,
    baseUrl: "http://localhost:3000",
    uxMode: "nodejs",
    tssLib: tssLib || tssLibDKLS,
    storage: storageInstance,
    manualSync,
  });

  const { idToken, parsedToken } = login ? await login(email) : await mockLogin(email);
  await instance.init({ handleRedirectResult: false, rehydrate: false });
  await instance.loginWithJWT({
    verifier: "torus-test-health",
    verifierId: parsedToken.email,
    idToken,
    importTssKey,
    registerExistingSFAKey
  });

  return instance;
};

export const loginWithSFA = async ({
  network,
  manualSync,
  email,
  storageInstance,
  login,
}: {
  network: WEB3AUTH_NETWORK_TYPE;
  manualSync: boolean;
  email: string;
  storageInstance: IStorage | IAsyncStorage;
  tssLib?: TssLibType;
  login?: LoginFunc;
}) => {
  const instance = new Web3AuthMPCCoreKit({
    web3AuthClientId: "torus-key-test",
    web3AuthNetwork: network,
    baseUrl: "http://localhost:3000",
    uxMode: "nodejs",
    tssLib: tssLib || tssLibDKLS,
    storage: storageInstance,
    manualSync,
  });

  const { idToken, parsedToken } = login ? await login(email) : await mockLogin(email);
  await instance.init();
  const nodeDetails = await instance.torusSp.customAuthInstance.nodeDetailManager.getNodeDetails({
    verifier: "torus-test-health",
    verifierId: parsedToken.email,
  })
  return await instance.torusSp.customAuthInstance.torus.retrieveShares({
    idToken,
    nodePubkeys: nodeDetails.torusNodePub,
    verifier: "torus-test-health",
    verifierParams: {
      verifier_id: parsedToken.email,
    },
    endpoints: nodeDetails.torusNodeEndpoints,
    indexes: nodeDetails.torusIndexes,
    // Match the SDK, which no longer uses DKG. torus.js otherwise defaults secp256k1 to DKG.
    useDkg: false,
  })

}

export class AsyncMemoryStorage implements IAsyncStorage {
  private _store: Record<string, string> = {};

  async getItem(key: string): Promise<string | null> {
    return this._store[key] || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this._store[key] = value;
  }
}

export function bufferToElliptic(p: Buffer, ec = secp256k1): EllipticPoint {
  return ec.keyFromPublic(p).getPublic();
}


export function generateRandomEmail(): string {
  return `${stringGen(10)}${TEST_IDENTITY_DOMAIN}`;
}

