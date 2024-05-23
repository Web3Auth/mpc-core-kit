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
  async function newCoreKitInstance(email: string) {
    return newCoreKitLogInInstance({
      network: WEB3AUTH_NETWORK.DEVNET,
      manualSync: testVariable.manualSync,
      email: email,
      storageInstance,
      tssLib: testVariable.tssLib,
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

      // Export key and logout.
      const exportedTssKey1 = await coreKitInstance._UNSAFE_exportTssKey();
      await coreKitInstance.logout();

      // recover key
      const recoveredTssKey = await coreKitInstance._UNSAFE_recoverTssKey([factorKeyDevice, factorKeyRecovery]);
      assert.strictEqual(recoveredTssKey, exportedTssKey1);
      
      // reset account
      // await criticalResetAccount(coreKitInstance);
      // BrowserStorage.getInstance("memory").resetStore();

      // initialize new instance
      const coreKitInstance2 = await newCoreKitInstance(testVariable.importKeyEmail);
      if (testVariable.manualSync) {
        await coreKitInstance2.commitChanges();
      }

      const exportedTssKey = await coreKitInstance2._UNSAFE_exportTssKey();
      // BrowserStorage.getInstance("memory").resetStore();

      assert.strictEqual(exportedTssKey, recoveredTssKey);

      // reinitialize corekit
      const coreKitInstance3 = await newCoreKitInstance(testVariable.importKeyEmail);
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
  // TODO enable again
  // { manualSync: false, email: "emailexport", importKeyEmail: "emailimport", tssLib: tssLibDKLS },
  // { manualSync: true, email: "emailexport", importKeyEmail: "emailimport", tssLib: tssLibDKLS },
  { manualSync: false, email: "emailexport_ed25519", importKeyEmail: "emailimport_ed25519", tssLib: tssLibFROST },
];

variable.forEach(async (testVariable) => {
  await ImportTest(testVariable);
});
