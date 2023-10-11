/* eslint-disable no-console */
import assert from "node:assert";
import test, { after, afterEach, before, describe, it } from "node:test";

import { getPubKeyPoint } from "@tkey-mpc/common-types";
import { UX_MODE, UX_MODE_TYPE } from "@toruslabs/customauth";
import BN from "bn.js";

import { COREKIT_STATUS, IdTokenLoginParams, TssShareType, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin } from "./setup";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  uxMode: UX_MODE_TYPE;
  manualSync?: boolean;
};
const variable: TestVariable[] = [
  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: UX_MODE.REDIRECT },
  { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT },

  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: UX_MODE.REDIRECT, manualSync: true },
  { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT, manualSync: true },
];

variable.forEach((testVariable) => {
  const { web3AuthNetwork, uxMode, manualSync } = testVariable;
  describe("#Tss Security Question", function () {
    const coreKitInstance = new Web3AuthMPCCoreKit({
      web3AuthClientId: "torus-key-test",
      web3AuthNetwork,
      baseUrl: "http://localhost:3000",
      uxMode,
      storageKey: "mock",
      manualSync,
    });

    before(async function () {
      if (coreKitInstance.status === COREKIT_STATUS.INITIALIZED) await criticalResetAccount(coreKitInstance);
      // login
    });

    test("should work", async function () {
      console.log("test started");
      const email = "testing0000899@example.com";

      const { idToken, parsedToken } = await mockLogin(email);

      const idTokenLoginParams = {
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      } as IdTokenLoginParams;
      await coreKitInstance.init();
      await coreKitInstance.loginWithJWT(idTokenLoginParams);
      console.log(coreKitInstance.state.oAuthKey);

      const factorKey = await coreKitInstance.createFactor({
        shareType: TssShareType.DEVICE,
      });
      console.log(factorKey);
      const factorPub = getPubKeyPoint(new BN(factorKey, "hex"));

      await coreKitInstance.deleteFactor(factorPub, factorKey);

      console.log(coreKitInstance.getKeyDetails());

      assert.strictEqual(1, 1);

      // set security question
      // recover factor
      // change factor
      // recover factor
      // recover factor
      // delete factor
      // recover factor
      // input factor
    });

    afterEach(function () {
      return console.log("finished running test");
    });
    after(function () {
      return console.log("finished running tests");
    });
  });
});
