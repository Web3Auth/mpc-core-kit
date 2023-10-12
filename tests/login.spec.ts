/* eslint-disable mocha/handle-done-callback */
import assert from "node:assert";
import test from "node:test";

import { UX_MODE, UX_MODE_TYPE } from "@toruslabs/customauth";
import BN from "bn.js";

import { COREKIT_STATUS, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin } from "./setup";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  uxMode: UX_MODE_TYPE;
  manualSync?: boolean;

  email: string;
};

const defaultTestEmail = "testEmail1";
const variable: TestVariable[] = [
  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: UX_MODE.REDIRECT, email: defaultTestEmail },
  // { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT, email: defaultTestEmail },

  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: UX_MODE.REDIRECT, manualSync: true, email: defaultTestEmail },
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
    storageKey: "mock",
    manualSync,
  });

  const testNameSuffix = JSON.stringify(testVariable);
  test(`#Login Test with JWT + logout :  ${testNameSuffix}`, async (t) => {
    t.before(async function () {
      if (coreKitInstance.status === COREKIT_STATUS.INITIALIZED) await criticalResetAccount(coreKitInstance);
    });

    t.after(async function () {
      // after all test tear down
    });

    // t.skip("#Login with Oauth", async function () {
    //   // popup
    //   // redirect flow
    //   // not testable
    // });
    await t.test("#Login ", async function () {
      // mocklogin
      const { idToken, parsedToken } = await mockLogin(email);
      await coreKitInstance.init();
      await coreKitInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });

      // get key details
      await checkLogin(coreKitInstance);
    });

    await t.test("#relogin ", async function () {
      // reload without rehydrate
      // await coreKitInstance.init({ rehydrate: false });

      // rehydrate
      await coreKitInstance.init();
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
  });
});
