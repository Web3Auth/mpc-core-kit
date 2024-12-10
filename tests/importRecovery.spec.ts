import assert from "node:assert";
import test from "node:test";

import { tssLib as tssLibDKLS } from "@toruslabs/tss-dkls-lib";
import { tssLib as tssLibFROST } from "@toruslabs/tss-frost-lib";

import { AsyncStorage, MemoryStorage, TssLibType, TssShareType, WEB3AUTH_NETWORK } from "../src";
import { bufferToElliptic, criticalResetAccount, newCoreKitLogInInstance } from "./setup";

type ImportKeyTestVariable = {
  manualSync?: boolean;
  email: string;
  importKeyEmail: string;
  tssLib: TssLibType;
};

const storageInstance = new MemoryStorage();
export const ImportTest = async (testVariable: ImportKeyTestVariable) => {
  async function newCoreKitInstance(email: string, importTssKey?: string) {
    return newCoreKitLogInInstance({
      network: WEB3AUTH_NETWORK.DEVNET,
      manualSync: testVariable.manualSync,
      email: email,
      storageInstance,
      tssLib: testVariable.tssLib,
      importTssKey,
    });
  }

  async function resetAccount(email: string) {
    const kit = await newCoreKitInstance(email);
    await criticalResetAccount(kit);
    await kit.logout();
    await new AsyncStorage(kit._storageKey, storageInstance).resetStore();
  }

  test(`import recover tss key : ${testVariable.manualSync}`, async function (t) {
    const beforeTest = async () => {
      await resetAccount(testVariable.email);
      await resetAccount(testVariable.importKeyEmail);
    };

    await beforeTest();

    await t.test("#recover Tss key using 2 factors key, import tss key to new oauth login", async function () {
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

      // Initialize new instance and import existing key.
      const coreKitInstance2 = await newCoreKitInstance(testVariable.importKeyEmail, recoveredTssKey);
      if (testVariable.manualSync) {
        await coreKitInstance2.commitChanges();
      }

      // Export key.
      const exportedTssKey = await coreKitInstance2._UNSAFE_exportTssKey();
      assert.strictEqual(exportedTssKey, recoveredTssKey);

      // Check exported key corresponds to pub key.
      const coreKitInstance3 = await newCoreKitInstance(testVariable.importKeyEmail);
      const tssPubkey = bufferToElliptic(coreKitInstance3.getPubKey());

      const exportedTssKey3 = await coreKitInstance3._UNSAFE_exportTssKey();
      const tssCurve = coreKitInstance3.tKey.tssCurve;
      const exportedPub = tssCurve.keyFromPrivate(exportedTssKey3).getPublic();
      assert(tssPubkey.eq(exportedPub));

      // Check exported key corresponds to pub key for account index > 0.
      if (coreKitInstance3.supportsAccountIndex) {
        coreKitInstance3.setTssWalletIndex(1);
        const exportedTssKeyIndex1 = await coreKitInstance3._UNSAFE_exportTssKey();
        const exportedPubIndex1 = tssCurve.keyFromPrivate(exportedTssKeyIndex1).getPublic();
        const tssPubKeyIndex1 = bufferToElliptic(coreKitInstance3.getPubKey());
        assert(exportedPubIndex1.eq(tssPubKeyIndex1));
      }
    });

    t.afterEach(function () {
      return console.info("finished running recovery test");
    });
    t.after(function () {
      return console.info("finished running recovery tests");
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
