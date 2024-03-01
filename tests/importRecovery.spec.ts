/* eslint-disable mocha/handle-done-callback */
import assert from "node:assert";
import test from "node:test";

import * as TssLib from "@toruslabs/tss-lib-node";
import { log } from "@web3auth/base";

import { BrowserStorage, IdTokenLoginParams, TssShareType, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin, newCoreKitLogInInstance } from "./setup";

type ImportKeyTestVariable = {
  manualSync?: boolean;
  email: string;
  importKeyEmail: string;
};
export const ImportTest = async (testVariable: ImportKeyTestVariable) => {
  test(`import recover tss key : ${testVariable.manualSync}`, async function (t) {
    t.before(async () => {
      const instance = await newCoreKitLogInInstance({
        network: WEB3AUTH_NETWORK.DEVNET,
        manualSync: false,
        email: testVariable.email,
      });
      await criticalResetAccount(instance);
      await instance.logout();

      const instance2 = await newCoreKitLogInInstance({
        network: WEB3AUTH_NETWORK.DEVNET,
        manualSync: testVariable.manualSync,
        email: testVariable.importKeyEmail,
      });
      await criticalResetAccount(instance2);
      await instance2.logout();
      BrowserStorage.getInstance("memory").resetStore();
    });

    await t.test("#recover Tss key using 2 factors key, import tss key to new oauth login", async function () {
      const { idToken, parsedToken } = await mockLogin(testVariable.email);

      const idTokenLoginParams = {
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      } as IdTokenLoginParams;

      const coreKitInstance = new Web3AuthMPCCoreKit({
        web3AuthClientId: "torus-key-test",
        web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
        baseUrl: "http://localhost:3000",
        uxMode: "nodejs",
        tssLib: TssLib,
        storageKey: "memory",
        manualSync: testVariable.manualSync,
      });

      await coreKitInstance.init();
      await coreKitInstance.loginWithJWT(idTokenLoginParams);

      const factorKeyDevice = await coreKitInstance.createFactor({
        shareType: TssShareType.DEVICE,
      });

      const factorKeyRecovery = await coreKitInstance.createFactor({
        shareType: TssShareType.RECOVERY,
      });

      if (testVariable.manualSync) {
        await coreKitInstance.commitChanges();
      }

      const exportedTssKey1 = await coreKitInstance._UNSAFE_exportTssKey();
      // recover key
      // reinitalize corekit
      await coreKitInstance.logout();
      BrowserStorage.getInstance("memory").resetStore();

      const recoveredTssKey = await coreKitInstance._UNSAFE_recoverTssKey([factorKeyDevice, factorKeyRecovery]);
      assert.strictEqual(recoveredTssKey, exportedTssKey1);

      await criticalResetAccount(coreKitInstance);
      BrowserStorage.getInstance("memory").resetStore();

      // reinitialize corekit
      const newEmail = testVariable.importKeyEmail;
      const newLogin = await mockLogin(newEmail);

      const newIdTokenLoginParams = {
        verifier: "torus-test-health",
        verifierId: newLogin.parsedToken.email,
        idToken: newLogin.idToken,
        importTssKey: recoveredTssKey,
      } as IdTokenLoginParams;

      const coreKitInstance2 = new Web3AuthMPCCoreKit({
        web3AuthClientId: "torus-key-test",
        web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
        baseUrl: "http://localhost:3000",
        uxMode: "nodejs",
        tssLib: TssLib,
        storageKey: "memory",
      });

      await coreKitInstance2.init();
      await coreKitInstance2.loginWithJWT(newIdTokenLoginParams);

      const exportedTssKey = await coreKitInstance2._UNSAFE_exportTssKey();
      BrowserStorage.getInstance("memory").resetStore();

      assert.strictEqual(exportedTssKey, recoveredTssKey);

      // reinitialize corekit
      const newEmail3 = testVariable.importKeyEmail;
      const newLogin3 = await mockLogin(newEmail);

      const newIdTokenLoginParams3 = {
        verifier: "torus-test-health",
        verifierId: newLogin3.parsedToken.email,
        idToken: newLogin3.idToken,
      } as IdTokenLoginParams;

      const coreKitInstance3 = new Web3AuthMPCCoreKit({
        web3AuthClientId: "torus-key-test",
        web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
        baseUrl: "http://localhost:3000",
        uxMode: "nodejs",
        tssLib: TssLib,
        storageKey: "memory",
      });

      await coreKitInstance3.init();
      await coreKitInstance3.loginWithJWT(newIdTokenLoginParams3);

      const exportedTssKey3 = await coreKitInstance3._UNSAFE_exportTssKey();
      console.log(exportedTssKey3);
    });

    t.afterEach(function () {
      return log.info("finished running recovery test");
    });
    t.after(function () {
      return log.info("finished running recovery tests");
    });
  });
};

const variable: ImportKeyTestVariable[] = [
  { manualSync: false, email: "emailexport", importKeyEmail: "emailimport" },
  { manualSync: true, email: "emailexport", importKeyEmail: "emailimport" },
];

variable.forEach(async (testVariable) => {
  await ImportTest(testVariable);
});
