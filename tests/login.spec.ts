/* eslint-disable mocha/handle-done-callback */
import assert from "node:assert";
import test from "node:test";

import { UX_MODE_TYPE } from "@toruslabs/customauth";
import { keccak256 } from "@toruslabs/metadata-helpers";
import * as TssLib from "@toruslabs/tss-lib-node";
import BN from "bn.js";
import { ec as EC } from "elliptic";

import { BrowserStorage, COREKIT_STATUS, DEFAULT_CHAIN_CONFIG, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin } from "./setup";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  uxMode: UX_MODE_TYPE | "nodejs";
  manualSync?: boolean;

  email: string;
};

const defaultTestEmail = "testEmail1";
const variable: TestVariable[] = [
  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: "nodejs", email: defaultTestEmail },
  // { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT, email: defaultTestEmail },

  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: "nodejs", manualSync: true, email: defaultTestEmail },
  // { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT, manualSync: true, email: defaultTestEmail },
];

const checkLogin = async (coreKitInstance: Web3AuthMPCCoreKit) => {
  const keyDetails = coreKitInstance.getKeyDetails();
  assert.strictEqual(coreKitInstance.status, COREKIT_STATUS.LOGGED_IN);
  assert.strictEqual(keyDetails.requiredFactors, 0);
  const factorkey = coreKitInstance.getCurrentFactorKey();
  await coreKitInstance.tKey.getTSSShare(new BN(factorkey.factorKey, "hex"));
};

variable.forEach((testVariable) => {
  const { web3AuthNetwork, uxMode, manualSync, email } = testVariable;
  const coreKitInstance = new Web3AuthMPCCoreKit({
    web3AuthClientId: "torus-key-test",
    web3AuthNetwork,
    baseUrl: "http://localhost:3000",
    uxMode,
    tssLib: TssLib,
    storageKey: "memory",
    manualSync,
  });
  const coreKitInstanceWithoutProvider = new Web3AuthMPCCoreKit({
    web3AuthClientId: "torus-key-test",
    web3AuthNetwork,
    baseUrl: "http://localhost:3000",
    uxMode,
    tssLib: TssLib,
    storageKey: "memory",
    manualSync,
    setupProviderOnInit: false,
  });

  const testNameSuffix = JSON.stringify(testVariable);
  test(`#Login Test with JWT + logout :  ${testNameSuffix}`, async (t) => {
    t.before(async function () {
      if (coreKitInstance.status === COREKIT_STATUS.INITIALIZED) await criticalResetAccount(coreKitInstance);
      BrowserStorage.getInstance("memory").resetStore();
    });

    t.after(async function () {
      // after all test tear down
    });

    // t.skip("#Login with Oauth", async function () {
    //   // popup
    //   // redirect flow
    //   // not testable
    // });
    await t.test("#Login with default provider", async function () {
      // mocklogin
      const { idToken, parsedToken } = await mockLogin(email);
      await coreKitInstance.init({ handleRedirectResult: false });
      await coreKitInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });
      // get key details
      await checkLogin(coreKitInstance);
      const result = await coreKitInstance.provider.request({ method: "eth_chainId", params: [] });
      assert.strictEqual(result, DEFAULT_CHAIN_CONFIG.chainId);
    });

    await t.test("#Login without provider", async function () {
      // mocklogin
      const { idToken, parsedToken } = await mockLogin(email);
      await coreKitInstanceWithoutProvider.init({ handleRedirectResult: false });
      await coreKitInstanceWithoutProvider.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });
      // get key details
      await checkLogin(coreKitInstanceWithoutProvider);
      assert.strictEqual(coreKitInstanceWithoutProvider.status, COREKIT_STATUS.LOGGED_IN);
      assert.strictEqual(coreKitInstanceWithoutProvider.provider, null);
      try {
        await coreKitInstanceWithoutProvider.provider.request({ method: "eth_chainId", params: [] });
        throw new Error("should not reach here");
      } catch (error) {}

      // setup provider
      await coreKitInstanceWithoutProvider.setupProvider({ chainConfig: DEFAULT_CHAIN_CONFIG });
      const result = await coreKitInstanceWithoutProvider.provider.request({ method: "eth_chainId", params: [] });
      assert.strictEqual(result, DEFAULT_CHAIN_CONFIG.chainId);
    });

    await t.test("#relogin ", async function () {
      // reload without rehydrate
      // await coreKitInstance.init({ rehydrate: false });

      // rehydrate
      await coreKitInstance.init({ handleRedirectResult: false });
      await checkLogin(coreKitInstance);

      // logout
      await coreKitInstance.logout();

      // rehydrate should fail
      await coreKitInstance.init();
      assert.strictEqual(coreKitInstance.status, COREKIT_STATUS.INITIALIZED);
      try {
        coreKitInstance.getCurrentFactorKey();
        throw new Error("should not reach here");
      } catch (error) {}

      // relogin
      const { idToken, parsedToken } = await mockLogin(email);
      await coreKitInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });

      // get key details
      await checkLogin(coreKitInstance);
    });

    await t.test("#able to sign", async function () {
      const msg = "hello world";
      const msgBuffer = Buffer.from(msg);
      const msgHash = keccak256(msgBuffer);
      const signature = await coreKitInstance.sign(msgHash);

      const secp256k1 = new EC("secp256k1");
      const pubkey = secp256k1.recoverPubKey(msgHash, signature, signature.v - 27);
      const publicKeyPoint = coreKitInstance.getTssPublicKey();
      assert.strictEqual(pubkey.x.toString("hex"), publicKeyPoint.x.toString("hex"));
      assert.strictEqual(pubkey.y.toString("hex"), publicKeyPoint.y.toString("hex"));
    });
  });
});
