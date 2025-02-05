import assert from "node:assert";
import test from "node:test";

import { tssLib as tssLibDKLS } from "@toruslabs/tss-dkls-lib";
import { tssLib as tssLibFROST } from "@toruslabs/tss-frost-lib";

import { AsyncStorage, MemoryStorage, TssLibType, TssShareType, WEB3AUTH_NETWORK } from "../src";
import { criticalResetAccount, generateRandomEmail, loginWithSFA, newCoreKitLogInInstance } from "./setup";

type ImportKeyTestVariable = {
  manualSync?: boolean;
  email: string;
  tssLib: TssLibType;
};

const storageInstance = new MemoryStorage();
export const ImportSFATest = async (testVariable: ImportKeyTestVariable) => {
  async function newCoreKitInstance(email: string) {
    return newCoreKitLogInInstance({
      network: WEB3AUTH_NETWORK.DEVNET,
      manualSync: testVariable.manualSync,
      email: email,
      storageInstance,
      tssLib: testVariable.tssLib,
      registerExistingSFAKey: true,
    });
  }

  async function resetAccount(email: string) {
    const kit = await newCoreKitInstance(email);
    await criticalResetAccount(kit);
    await kit.logout();
    await new AsyncStorage(kit._storageKey, storageInstance).resetStore();
  }

  test(`import sfa key and recover tss key : ${testVariable.manualSync}`, async function (t) {
    const afterTest = async () => {
        await resetAccount(testVariable.email);
      };
    await t.test("#recover Tss key using 2 factors key, import tss key to new oauth login", async function () {
      const sfaResult = await loginWithSFA({
        network: WEB3AUTH_NETWORK.DEVNET,
        manualSync: testVariable.manualSync,
        email: testVariable.email,
        storageInstance,
      });
      const coreKitInstance = await newCoreKitInstance(testVariable.email);

      // Create 2 factors which will be used to recover tss key.
      const factorKeyDevice = await coreKitInstance.createFactor({
        shareType: TssShareType.DEVICE,
      });

      const factorKeyRecovery = await coreKitInstance.createFactor({
        shareType: TssShareType.RECOVERY,
      });

      if (testVariable.manualSync) {
        await coreKitInstance.commitChanges();
      }

      // Export key and logout.
      const exportedTssKey1 = await coreKitInstance._UNSAFE_exportTssKey();
      await coreKitInstance.logout();

      // Recover key from any two factors.
      const recoveredTssKey = await coreKitInstance._UNSAFE_recoverTssKey([factorKeyDevice, factorKeyRecovery]);
      assert.strictEqual(recoveredTssKey, exportedTssKey1);
      assert.strictEqual(sfaResult.finalKeyData.privKey,recoveredTssKey);
    // sfa key should be empty after import to mpc
    const sfaResult2 = await loginWithSFA({
      network: WEB3AUTH_NETWORK.DEVNET,
      manualSync: testVariable.manualSync,
      email: testVariable.email,
      storageInstance,
    });
    assert.strictEqual(sfaResult2.finalKeyData.privKey, "");
        
    const coreKitInstance2 = await newCoreKitInstance(testVariable.email);
    const tssKey2 = await coreKitInstance2._UNSAFE_exportTssKey();
    // core kit should have same sfa key which was imported before
    assert.strictEqual(tssKey2, exportedTssKey1);
    assert.strictEqual(sfaResult.finalKeyData.privKey, tssKey2);


    });

    await afterTest();
    t.afterEach(function () {
      return console.info("finished running recovery test");
    });
    t.after(function () {
      return console.info("finished running recovery tests");
    });
  });
};

const variable: ImportKeyTestVariable[] = [
  { manualSync: false, email: generateRandomEmail(), tssLib: tssLibDKLS },
  { manualSync: true, email: generateRandomEmail(), tssLib: tssLibDKLS },
  { manualSync: false, email: generateRandomEmail(), tssLib: tssLibFROST },
];

variable.forEach(async (testVariable) => {
  await ImportSFATest(testVariable);
});
