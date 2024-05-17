import { tssLib } from "@toruslabs/tss-dkls-lib";
import BN from "bn.js";
import jwt, { Algorithm } from "jsonwebtoken";

import { IAsyncStorage, parseToken, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";

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
    privKey: new BN(coreKitInstance.state.oAuthKey!, "hex"),
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

export const newCoreKitLogInInstance = async ({
  network,
  manualSync,
  email,
}: {
  network: WEB3AUTH_NETWORK_TYPE;
  manualSync: boolean;
  email: string;
}) => {
  const instance = new Web3AuthMPCCoreKit({
    web3AuthClientId: "torus-key-test",
    web3AuthNetwork: network,
    baseUrl: "http://localhost:3000",
    uxMode: "nodejs",
    tssLib,
    storageKey: "memory",
    manualSync,
  });

  const { idToken, parsedToken } = await mockLogin(email);
  await instance.init();
  try {
    await instance.loginWithJWT({
      verifier: "torus-test-health",
      verifierId: parsedToken.email,
      idToken,
    });
  } catch (error) {}

  return instance;
};

export class AsyncMemoryStorage implements IAsyncStorage {
  private _store: Record<string, string> = {};

  async getItem(key: string): Promise<string | null> {
    return this._store[key] || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this._store[key] = value;
  }
}
