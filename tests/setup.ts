import { UX_MODE } from "@toruslabs/customauth";
import BN from "bn.js";
import jwt, { Algorithm } from "jsonwebtoken";

import { parseToken, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
if (global.navigator === undefined) {
  const nav = global.navigator;
  global.navigator = { ...nav, userAgent: "test" };
}
global.window = undefined;

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
    privKey: new BN(coreKitInstance.metadataKey!, "hex"),
    input: { message: "KEY_NOT_FOUND" },
  });
};

const privateKey = "MEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCCD7oLrcKae+jVZPGx52Cb/lKhdKxpXjl9eGNa1MlY57A==";
const jwtPrivateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
const alg: Algorithm = "ES256";

export const mockLogin = async (email: string) => {
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
    uxMode: UX_MODE.REDIRECT,
    storageKey: "mock",
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
