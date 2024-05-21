import assert from "node:assert";
import test from "node:test";

import { Point, secp256k1 } from "@tkey/common-types";
import { tssLib as tssLibDKLS } from "@toruslabs/tss-dkls-lib";
import { tssLib as tssLibFROST } from "@toruslabs/tss-frost-lib";
import { log } from "@web3auth/base";
import { BN } from "bn.js";

import { AsyncStorage, IdTokenLoginParams, MemoryStorage, TssLib, TssShareType, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "../src";
import { bufferToElliptic, criticalResetAccount, mockLogin, mockLogin2, newCoreKitLogInInstance } from "./setup";

type ImportKeyTestVariable = {
  manualSync?: boolean;
  email: string;
  importKeyEmail: string;
  tssLib: TssLib;
};

const storageInstance = new MemoryStorage();
export const ImportTest = async (testVariable: ImportKeyTestVariable) => {
  test(`import recover tss key : ${testVariable.manualSync}`, async function (t) {
    const beforeTest = async () => {
      const instance = await newCoreKitLogInInstance({
        network: WEB3AUTH_NETWORK.DEVNET,
        manualSync: false,
        email: testVariable.email,
        storageInstance,
        tssLib: testVariable.tssLib,
      });
      await criticalResetAccount(instance);
      await instance.logout();

      const instance2 = await newCoreKitLogInInstance({
        network: WEB3AUTH_NETWORK.DEVNET,
        manualSync: testVariable.manualSync,
        email: testVariable.importKeyEmail,
        storageInstance,
        tssLib: testVariable.tssLib,
      });
      await criticalResetAccount(instance2);
      await instance2.logout();
      await new AsyncStorage(instance2._storageKey, storageInstance).resetStore();
    };

    await beforeTest();
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
        tssLib: testVariable.tssLib,
        storage: new MemoryStorage(),
        manualSync: testVariable.manualSync,
      });

      await coreKitInstance.init();
      await coreKitInstance.loginWithJWT(idTokenLoginParams);

      // Create 2 factors which will be use to recover tss key
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
      // BrowserStorage.getInstance("memory").resetStore();

      const recoveredTssKey = await coreKitInstance._UNSAFE_recoverTssKey([factorKeyDevice, factorKeyRecovery]);
      assert.strictEqual(recoveredTssKey, exportedTssKey1);

      // relogin to reset account
      await coreKitInstance.init();
      const localToken = await mockLogin2(testVariable.email);
      idTokenLoginParams.idToken = localToken.idToken;
      await coreKitInstance.loginWithJWT(idTokenLoginParams);
      await criticalResetAccount(coreKitInstance);
      // BrowserStorage.getInstance("memory").resetStore();

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
        tssLib: testVariable.tssLib,
        storage: new MemoryStorage(),
      });

      await coreKitInstance2.init();
      await coreKitInstance2.loginWithJWT(newIdTokenLoginParams);

      if (testVariable.manualSync) {
        await coreKitInstance2.commitChanges();
      }

      const exportedTssKey = await coreKitInstance2._UNSAFE_exportTssKey();
      // BrowserStorage.getInstance("memory").resetStore();

      assert.strictEqual(exportedTssKey, recoveredTssKey);

      // reinitialize corekit
      const newEmail3 = testVariable.importKeyEmail;
      const newLogin3 = await mockLogin(newEmail3);

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
        tssLib: testVariable.tssLib,
        storage: new MemoryStorage(),
      });

      await coreKitInstance3.init();
      await coreKitInstance3.loginWithJWT(newIdTokenLoginParams3);
      const tssPubkey = bufferToElliptic(coreKitInstance3.getPubKey());

      const exportedTssKey3 = await coreKitInstance3._UNSAFE_exportTssKey();
      const pubkey = Point.fromScalar(new BN(exportedTssKey3, "hex"), coreKitInstance.tKey.tssCurve);
      assert(tssPubkey.eq(pubkey.toEllipticPoint(secp256k1)));
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
  { manualSync: false, email: "emailexport", importKeyEmail: "emailimport", tssLib: tssLibDKLS },
  { manualSync: true, email: "emailexport", importKeyEmail: "emailimport", tssLib: tssLibDKLS },
  { manualSync: false, email: "emailexport_ed25519", importKeyEmail: "emailimport_ed25519", tssLib: tssLibFROST },
];

variable.forEach(async (testVariable) => {
  await ImportTest(testVariable);
});
