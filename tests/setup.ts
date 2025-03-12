import { EllipticPoint, KeyType, secp256k1 } from "@tkey/common-types";
import BN from "bn.js";
import jwt, { Algorithm } from "jsonwebtoken";
import { tssLib as tssLibDKLS } from "@toruslabs/tss-dkls-lib";
import { TorusKey } from "@toruslabs/torus.js";

import { IAsyncStorage, IStorage, parseToken, TssLibType, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { MockStorageLayer } from "@tkey/storage-layer-torus";

export const mockLogin2 = async (email: string) => {
  const req = new Request("https://li6lnimoyrwgn2iuqtgdwlrwvq0upwtr.lambda-url.eu-west-1.on.aws/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ verifier: "torus-key-test", scope: "email", extraPayload: { email }, alg: "ES256" }),
  });

  const resp = await fetch(req);
  const bodyJson = (await resp.json()) as { token: string };
  const idToken = bodyJson.token;
  const parsedToken = parseToken(idToken);
  return { idToken, parsedToken };
};

export const criticalResetAccount = async (coreKitInstance: Web3AuthMPCCoreKit): Promise<void> => {
  // This is a critical function that should only be used for testing purposes
  // Resetting your account means clearing all the metadata associated with it from the metadata server
  // The key details will be deleted from our server and you will not be able to recover your account
  if (!coreKitInstance) {
    throw new Error("coreKitInstance is not set");
  }

  await coreKitInstance.tKey.storageLayer.setMetadata({
    privKey: new BN(coreKitInstance.state.postBoxKey!, "hex"),
    input: { message: "KEY_NOT_FOUND" },
  });
};

const privateKey = "MEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCCD7oLrcKae+jVZPGx52Cb/lKhdKxpXjl9eGNa1MlY57A==";
const jwtPrivateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
const alg: Algorithm = "ES256";

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
  if (!email) {
    email = `${stringGen(10)}@${stringGen(5)}.${stringGen(3)}`;
  }

  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "torus-key-test",
    aud: "torus-key-test",
    name: email,
    email,
    scope: "email",
    iat,
    eat: iat + 120,
  };

  const algo = {
    expiresIn: 120,
    algorithm: alg,
  };

  const token = jwt.sign(payload, jwtPrivateKey, algo);
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
  mockStorageLayer,
  tssLib,
  legacyFlag,
}: {
  network: WEB3AUTH_NETWORK_TYPE;
  manualSync: boolean;
  email: string;
  storageInstance: IStorage | IAsyncStorage;
  tssLib?: TssLibType;
  importTssKey?: string;
  registerExistingSFAKey?: boolean;
  login?: LoginFunc;
  mockStorageLayer?: MockStorageLayer;
  legacyFlag?: boolean;
  }) => {
  const localTsslib = tssLib ?? tssLibDKLS;
  
  const instance = new Web3AuthMPCCoreKit({
    web3AuthClientId: "torus-key-test",
    web3AuthNetwork: network,
    baseUrl: "http://localhost:3000",
    uxMode: "nodejs",
    supportedKeyTypes: [localTsslib.keyType as KeyType],
    storage: storageInstance,
    manualSync,
    legacyFlag,
  });
  instance.addTssLibs([localTsslib])

  const { idToken, parsedToken } = login ? await login(email) : await mockLogin(email);
  await instance.init();

  if (mockStorageLayer) {
    instance.tKey.storageLayer = mockStorageLayer
  }

  const finalImportKey = importTssKey ? { [localTsslib.keyType]: importTssKey } : undefined;
  await instance.loginWithJWT({
    verifier: "torus-test-health",
    verifierId: parsedToken.email,
    idToken,
    importTssKey: finalImportKey,
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
  tssLib,
  legacyFlag,
  mockStorageLayer,
}: {
  network: WEB3AUTH_NETWORK_TYPE;
  manualSync: boolean;
  email: string;
  storageInstance: IStorage | IAsyncStorage;
  tssLib?: TssLibType;
  login?: LoginFunc;
  legacyFlag?: boolean;
  mockStorageLayer?: MockStorageLayer;
  }): Promise<TorusKey> => {
  
  const localTssLib = tssLib ?? tssLibDKLS
  
  const instance = new Web3AuthMPCCoreKit({
    web3AuthClientId: "torus-key-test",
    web3AuthNetwork: network,
    baseUrl: "http://localhost:3000",
    uxMode: "nodejs",
    supportedKeyTypes: [localTssLib.keyType as KeyType],
    storage: storageInstance,
    manualSync,
    legacyFlag,
  });

  const { idToken, parsedToken } = login ? await login(email) : await mockLogin(email);
  await instance.init();

  // mock storate layer
  if (mockStorageLayer) {
    instance.tKey.storageLayer = mockStorageLayer
  }

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
  const username = stringGen(100); 
  const domain = stringGen(5); 
  const tld = stringGen(3);     
  return `${username}@${domain}.${tld}`;
}

