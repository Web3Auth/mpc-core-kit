import assert from "node:assert";
import test, { after, before, describe, it } from "node:test";

import { tssLib as tssLibDKLS } from "@toruslabs/tss-dkls-lib";
import { tssLib as tssLibFROST } from "@toruslabs/tss-frost-lib";

import { AsyncStorage, MemoryStorage, TssLibType, TssShareType, WEB3AUTH_NETWORK } from "../src";
import { criticalResetAccount, generateRandomEmail, loginWithSFA, newCoreKitLogInInstance } from "./setup";
import { KeyType } from "@tkey/common-types";

type ImportKeyTestVariable = {
  manualSync?: boolean;
  email: string;
  tssLib: TssLibType;
  legacyFlag: boolean;
};

const storageInstance = new MemoryStorage();
export const ImportSFATest = async (testVariable: ImportKeyTestVariable) => {
  async function newCoreKitInstance(email: string) {
    const instance = await newCoreKitLogInInstance({
      network: WEB3AUTH_NETWORK.DEVNET,
      manualSync: testVariable.manualSync,
      email: email,
      storageInstance,
      tssLib: testVariable.tssLib,
      registerExistingSFAKey: true,
      legacyFlag: testVariable.legacyFlag,
    });
    return instance;
  }
  
  async function resetAccount(email: string) {
    const kit = await newCoreKitInstance(email);
    await criticalResetAccount(kit);
    await kit.logout();
    await new AsyncStorage(kit._storageKey, storageInstance).resetStore();
  }

  describe(`import sfa key and recover tss key manualSync: ${testVariable.manualSync} siging lib ${testVariable.tssLib.sigType}`, async function (t) {
    const keyType = testVariable.tssLib.keyType as KeyType;

    after(async () => {
      await resetAccount(testVariable.email);
    });

    it("#recover Tss key using 2 factors key, import tss key to new oauth login", async function () {
      const sfaResult = await loginWithSFA({
        network: WEB3AUTH_NETWORK.DEVNET,
        manualSync: testVariable.manualSync,
        email: testVariable.email,
        legacyFlag: testVariable.legacyFlag,
        storageInstance,
        tssLib: testVariable.tssLib,
        
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
      const exportedTssKey1 = await coreKitInstance._UNSAFE_exportTssKey(keyType);
      let exportEd25519Seed : string | undefined = undefined
      if (keyType === KeyType.ed25519) { 
        const edResult = await coreKitInstance._UNSAFE_exportTssEd25519Seed()
        exportEd25519Seed = edResult.toString("hex")
      }

      // Recover key from any two factors.
      const recoveredTssKey = await coreKitInstance._UNSAFE_recoverTssKey([factorKeyDevice, factorKeyRecovery], keyType);
      assert.strictEqual(recoveredTssKey, exportedTssKey1);
      assert.strictEqual(sfaResult.finalKeyData.privKey, exportEd25519Seed ?? exportedTssKey1);
      // sfa key should be empty after import to mpc
      const sfaResult2 = await loginWithSFA({
        network: WEB3AUTH_NETWORK.DEVNET,
        manualSync: testVariable.manualSync,
        email: testVariable.email,
        storageInstance,
        tssLib: testVariable.tssLib,
        legacyFlag: testVariable.legacyFlag,
      });
      assert.strictEqual(sfaResult2.finalKeyData.privKey, "");
          
      const coreKitInstance2 = await newCoreKitInstance(testVariable.email);

      const tssKey2 = await coreKitInstance2._UNSAFE_exportTssKey(keyType);
      
      exportEd25519Seed = undefined
      if (keyType === KeyType.ed25519) { 
        const edResult = await coreKitInstance2._UNSAFE_exportTssEd25519Seed()
        exportEd25519Seed = edResult.toString("hex")
      } 
      // core kit should have same sfa key which was imported before
      assert.strictEqual(tssKey2, exportedTssKey1);
      assert.strictEqual(sfaResult.finalKeyData.privKey, exportEd25519Seed ?? tssKey2);
    });
  });
};

const variable: ImportKeyTestVariable[] = [
  { manualSync: false, email: generateRandomEmail(), tssLib: tssLibDKLS, legacyFlag: false },
  { manualSync: true, email: generateRandomEmail(), tssLib: tssLibDKLS , legacyFlag: false},
  { manualSync: false, email: generateRandomEmail(), tssLib: tssLibFROST, legacyFlag: true },
];

variable.forEach(async (testVariable) => {
  await ImportSFATest(testVariable);
});
