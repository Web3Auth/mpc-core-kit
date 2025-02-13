import assert from "node:assert";
import test, { describe, it } from "node:test";

import { tssLib as tssLibDKLS } from "@toruslabs/tss-dkls-lib";
import { tssLib as tssLibFROST } from "@toruslabs/tss-frost-lib";

import { AsyncStorage, MemoryStorage, TssLibType, TssShareType, WEB3AUTH_NETWORK } from "../src";
import { bufferToElliptic, criticalResetAccount, newCoreKitLogInInstance } from "./setup";
import { getKeyCurve } from "@toruslabs/torus.js";
import { KeyType, Point } from "@tkey/common-types";
import { MockStorageLayer } from "@tkey/storage-layer-torus";
import { BN } from "bn.js";

type ImportKeyTestVariable = {
  manualSync?: boolean;
  email: string;
  importKeyEmail: string;
  tssLib: TssLibType;
  legacyFlag?: boolean;
};

const storageInstance = new MemoryStorage();

// use mockStorageLayer, hence resetAccount is not required.
const mockStorageLayer = new MockStorageLayer();
export const ImportTest = async (testVariable: ImportKeyTestVariable) => {
  async function newCoreKitInstance(email: string, importTssKey?: string) {
    return newCoreKitLogInInstance({
      network: WEB3AUTH_NETWORK.DEVNET,
      manualSync: testVariable.manualSync,
      email: email,
      storageInstance,
      tssLib: testVariable.tssLib,
      importTssKey,
      legacyFlag: testVariable.legacyFlag,
      mockStorageLayer,
    });
  }

  describe(`import recover tss key : ${testVariable.manualSync}, testVariable: ${testVariable}`, async function (t) {
    it("#recover Tss key using 2 factors key, import tss key to new oauth login", async function () {
      const coreKitInstance = await newCoreKitInstance(testVariable.email);

      const keyType = coreKitInstance.getSupportedCurveKeyTypes()[0];
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

      const ed25519ImportSeed = (keyType === KeyType.ed25519)?  (await coreKitInstance._UNSAFE_exportTssEd25519Seed()).toString("hex") : undefined ;
      await coreKitInstance.logout();

      // logout re-init storagelayer, reassign to mock is required
      coreKitInstance.tKey.storageLayer = mockStorageLayer;

      // Recover key from any two factors.
      const recoveredTssKey = await coreKitInstance._UNSAFE_recoverTssKey([factorKeyDevice, factorKeyRecovery], keyType);
      assert.strictEqual(recoveredTssKey, exportedTssKey1);

      // import for ed25519 need to be seed.
      const importKey = ed25519ImportSeed ?? recoveredTssKey ;

      // Initialize new instance and import existing key.
      const coreKitInstance2 = await newCoreKitInstance(testVariable.importKeyEmail, importKey);
      if (testVariable.manualSync) {
        await coreKitInstance2.commitChanges();
      }

      // Export key.
      const exportedTssKey = await coreKitInstance2._UNSAFE_exportTssKey(keyType);
      assert.strictEqual(exportedTssKey, recoveredTssKey);

      // Check exported key corresponds to pub key.
      const coreKitInstance3 = await newCoreKitInstance(testVariable.importKeyEmail);
      const tssPubkey = coreKitInstance3.getPubKeyPoint(keyType).toEllipticPoint(getKeyCurve(keyType));

      const exportedTssKey3 = await coreKitInstance3._UNSAFE_exportTssKey(keyType);
      const tssCurve = getKeyCurve(keyType);
      const exportedPub = tssCurve.keyFromPrivate(exportedTssKey3).getPublic();
      console.log(exportedPub.encodeCompressed("hex"))
      console.log(tssPubkey.encodeCompressed("hex"))
      assert(tssPubkey.eq(exportedPub));

      // Check exported key corresponds to pub key for account index > 0.
      if (keyType !== KeyType.ed25519) {
        coreKitInstance3.setTssWalletIndex(1);
        const exportedTssKeyIndex1 = await coreKitInstance3._UNSAFE_exportTssKey(keyType);
        const exportedPubIndex1 = tssCurve.keyFromPrivate(exportedTssKeyIndex1).getPublic();
        const tssPubKeyIndex1 = bufferToElliptic(coreKitInstance3.getPubKey(keyType));
        assert(exportedPubIndex1.eq(tssPubKeyIndex1));
      }
    });
  });
};

const variable: ImportKeyTestVariable[] = [
  // { manualSync: false, email: "emailexport", importKeyEmail: "emailimport", tssLib: tssLibDKLS },
  // { manualSync: true, email: "emailexport", importKeyEmail: "emailimport", tssLib: tssLibDKLS },
  { manualSync: false, email: "emailexport_ed25519", importKeyEmail: "emailimport_ed25519", tssLib: tssLibFROST },
];

variable.forEach(async (testVariable) => {
  await ImportTest(testVariable);
});
