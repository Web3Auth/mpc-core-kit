import { factorKeyCurve, getPubKeyPoint } from "@tkey/tss";
import { tssLib as tssLibDKLS } from "@toruslabs/tss-dkls-lib";
import BN from "bn.js";
import assert from "node:assert";
import test from "node:test";

import {
  COREKIT_STATUS,
  FactorKeyTypeShareDescription,
  generateFactorKey,
  getHashedPrivateKey,
  IAsyncStorage,
  IStorage,
  MemoryStorage,
  TssLibType,
  TssShareType,
  WEB3AUTH_NETWORK,
  Web3AuthMPCCoreKit,
} from "../src";
import { criticalResetAccount, mockLogin } from "./setup";
import { Point, secp256k1 } from "@tkey/common-types";

type FactorTestVariable = {
  manualSync?: boolean;
  storage?: IAsyncStorage | IStorage;
  email: string;
  tssLib?: TssLibType;
  userAgent?: string;
};

export const FactorManipulationTest = async (testVariable: FactorTestVariable) => {
  const { email, tssLib } = testVariable;
  const newInstance = async () => {
    const instance = new Web3AuthMPCCoreKit({
      web3AuthClientId: "torus-key-test",
      web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
      baseUrl: "http://localhost:3000",
      uxMode: "nodejs",
      tssLib: tssLib || tssLibDKLS,
      storage: testVariable.storage,
      manualSync: testVariable.manualSync,
    });

    const { idToken, parsedToken } = await mockLogin(email);
    await instance.init({ handleRedirectResult: false, rehydrate: false });
    await instance.loginWithJWT({
      verifier: "torus-test-health",
      verifierId: parsedToken.email,
      idToken,
    });
    return instance;
  };

  async function beforeTest() {
    const resetInstance = await newInstance();
    await criticalResetAccount(resetInstance);
    await resetInstance.logout();
  }

  await test(`#Factor manipulation - manualSync ${testVariable.manualSync} `, async function (t) {
    await beforeTest();

    await t.test("should be able to create factor", async function () {
      const coreKitInstance = await newInstance();
      assert.equal(coreKitInstance.status, COREKIT_STATUS.LOGGED_IN, "Instance should be logged in after initialization");

      await coreKitInstance.commitChanges();

      const socialFactorKey = new BN(coreKitInstance.state.postBoxKey, "hex");
      await coreKitInstance.enableMFA({
        factorKey: socialFactorKey,
        shareDescription: FactorKeyTypeShareDescription.SocialShare,
      });

      // Sync if manualSync is enabled
      if (testVariable.manualSync) {
        await coreKitInstance.commitChanges();
      }

      // Create a new instance to simulate another device
      const instance2 = await newInstance();
      assert.equal(instance2.status, COREKIT_STATUS.REQUIRED_SHARE, "Second instance should require a share");

      const pubKeyX = await instance2.requestShare(testVariable.userAgent);
      const transferStore = await coreKitInstance.getShareTransferStore();
      assert(Object.keys(transferStore).length > 0, "Share transfer store should have pending requests");

      await coreKitInstance.approveShareRequest(Object.keys(transferStore)[0]);
      assert.equal(instance2.status, COREKIT_STATUS.REQUIRED_SHARE, "Second instance should still require a share until input");

      await instance2.waitForRequestShareResponse(pubKeyX);
      await instance2.inputFactorKey(socialFactorKey);
      assert.equal(instance2.status, COREKIT_STATUS.LOGGED_IN, "Second instance should be logged in after inputting factor key");

      // Create a new factor (recovery factor)
      const otherFactorKey = generateFactorKey().private;
      await instance2.createFactor({
        factorKey: otherFactorKey,
        shareType: TssShareType.RECOVERY,
        shareDescription: FactorKeyTypeShareDescription.Other,
      });

      await instance2.inputFactorKey(otherFactorKey);
      await instance2.logout();

      // Create a third instance to verify recovery
      const instance3 = await newInstance();
      await instance3.inputFactorKey(new BN(await instance3.getDeviceFactor(), "hex"));
      await instance3.inputFactorKey(socialFactorKey);
      assert.equal(instance3.status, COREKIT_STATUS.LOGGED_IN, "Third instance should be logged in after inputting factor keys");

      // Verify the recovery factor exists
      let factorPub: string | undefined;
      for (const [key, value] of Object.entries(instance3.getKeyDetails().shareDescriptions)) {
        if (value.length > 0) {
          const parsedData = JSON.parse(value[0]);
          if (parsedData.module === FactorKeyTypeShareDescription.Other) {
            factorPub = key;
          }
        }
      }
      assert(factorPub, "Recovery factor should exist in key details");

      // Delete the recovery factor
      const pub = Point.fromSEC1(secp256k1, factorPub);
      await instance3.deleteFactor(pub);
      await instance3.commitChanges();

      factorPub = undefined;

      for (const [key, value] of Object.entries(instance3.getKeyDetails().shareDescriptions)) {
        if (value.length > 0) {
          const parsedData = JSON.parse(value[0]);
          if (parsedData.module === FactorKeyTypeShareDescription.Other) {
            factorPub = key;
          }
        }
      }

      assert(!factorPub, "Recovery factor should be deleted");

      await coreKitInstance.logout();
      await instance3.logout();
    });
  });
};

const variable: FactorTestVariable[] = [
  {
    manualSync: true,
    storage: new MemoryStorage(),
    email: "testmail1012",
    userAgent: "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  },
  //   { manualSync: false, storage: new MemoryStorage(), email: "testmail1013" },

  //   { manualSync: true, storage: new AsyncMemoryStorage(), email: "testmail1014" },
  //   { manualSync: false, storage: new AsyncMemoryStorage(), email: "testmail1015" },

  //   { manualSync: true, storage: new MemoryStorage(), email: "testmail1012ed25519", tssLib: tssLibFROST },
];

variable.forEach(async (testVariable) => {
  await FactorManipulationTest(testVariable);
});
