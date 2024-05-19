/* eslint-disable mocha/handle-done-callback */
import assert from "node:assert";
import test from "node:test";

import { Point } from "@tkey/common-types";
import { factorKeyCurve } from "@tkey/tss";
import { tssLib } from "@toruslabs/tss-dkls-lib";
import BN from "bn.js";

import {
  asyncGetFactor,
  COREKIT_STATUS,
  getWebBrowserFactor,
  IAsyncStorage,
  MemoryStorage,
  SupportedStorageType,
  TssShareType,
  WEB3AUTH_NETWORK,
  Web3AuthMPCCoreKit,
} from "../src";
import { AsyncMemoryStorage, criticalResetAccount, mockLogin } from "./setup";

type FactorTestVariable = {
  manualSync?: boolean;
  storage?: IAsyncStorage | IStorage;
  email: string;
};

//   const { types } = factor;

export const FactorManipulationTest = async (testVariable: FactorTestVariable) => {
  const { email } = testVariable;
  const newInstance = async () => {
    const instance = new Web3AuthMPCCoreKit({
      web3AuthClientId: "torus-key-test",
      web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
      baseUrl: "http://localhost:3000",
      uxMode: "nodejs",
      tssLib: TssLib,
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

    await t.test("should able to create factor", async function () {
      const coreKitInstance = await newInstance();
      assert.equal(coreKitInstance.status, COREKIT_STATUS.LOGGED_IN);

      coreKitInstance.setTssWalletIndex(1);

      coreKitInstance.setTssWalletIndex(0);
      const tssPubKeyIndex0 = coreKitInstance.getTssPublicKey();

      coreKitInstance.setTssWalletIndex(1);
      const tssPubKeyIndex1 = coreKitInstance.getTssPublicKey();

      coreKitInstance.setTssWalletIndex(99);
      const tssPubKeyIndex99 = coreKitInstance.getTssPublicKey();

      const firstFactor = coreKitInstance.getCurrentFactorKey();
      // try delete hash factor factor
      await assert.rejects(() => {
        const pt = Point.fromScalar(firstFactor.factorKey, factorKeyCurve);
        await coreKitInstance.deleteFactor(pt);
        throw new Error("should not reach here");
      });

      // create factor
      const factorKey1 = await coreKitInstance.createFactor({
        shareType: TssShareType.DEVICE,
      });

      coreKitInstance.setTssWalletIndex(2);
      const factorKey2 = await coreKitInstance.createFactor({
        shareType: TssShareType.RECOVERY,
      });

      // sync
      if (testVariable.manualSync) {
        await coreKitInstance.commitChanges();
      }

      coreKitInstance.setTssWalletIndex(0);
      const tssPubKeyIndexPost0 = coreKitInstance.getTssPublicKey();

      coreKitInstance.setTssWalletIndex(1);
      const tssPubKeyIndexPost1 = coreKitInstance.getTssPublicKey();

      coreKitInstance.setTssWalletIndex(99);
      const tssPubKeyIndexPost99 = coreKitInstance.getTssPublicKey();

      // clear session prevent rehydration
      await coreKitInstance.logout();

      // new instance
      const instance2 = await newInstance();
      assert.strictEqual(instance2.getTssFactorPub().length, 3);

      // try inputFactor ( set as active factor )

      // delete factor
      instance2.setTssWalletIndex(0);
      const pt = Point.fromScalar(new BN(factorKey1, "hex"), factorKeyCurve);
      await instance2.deleteFactor(pt);

      // delete factor
      instance2.setTssWalletIndex(1);
      const pt2 = Point.fromScalar(new BN(factorKey2, "hex"), factorKeyCurve);
      await instance2.deleteFactor(pt2);

      if (testVariable.manualSync) {
        await instance2.commitChanges();
      }

      instance2.setTssWalletIndex(0);
      const tssPubKey2IndexPost0 = instance2.getTssPublicKey();

      instance2.setTssWalletIndex(1);
      const tssPubKey2IndexPost1 = instance2.getTssPublicKey();

      instance2.setTssWalletIndex(99);
      const tssPubKey2IndexPost99 = instance2.getTssPublicKey();

      assert.equal(tssPubKeyIndex0.x.toString("hex"), tssPubKeyIndexPost0.x.toString("hex"));
      assert.equal(tssPubKeyIndex1.x.toString("hex"), tssPubKeyIndexPost1.x.toString("hex"));
      assert.equal(tssPubKeyIndex99.x.toString("hex"), tssPubKeyIndexPost99.x.toString("hex"));

      assert.equal(tssPubKeyIndex0.y.toString("hex"), tssPubKeyIndexPost0.y.toString("hex"));
      assert.equal(tssPubKeyIndex1.y.toString("hex"), tssPubKeyIndexPost1.y.toString("hex"));
      assert.equal(tssPubKeyIndex99.y.toString("hex"), tssPubKeyIndexPost99.y.toString("hex"));

      assert.equal(tssPubKey2IndexPost0.x.toString("hex"), tssPubKeyIndex0.x.toString("hex"));
      assert.equal(tssPubKey2IndexPost1.x.toString("hex"), tssPubKeyIndex1.x.toString("hex"));
      assert.equal(tssPubKey2IndexPost99.x.toString("hex"), tssPubKeyIndex99.x.toString("hex"));

      assert.equal(tssPubKey2IndexPost0.y.toString("hex"), tssPubKeyIndex0.y.toString("hex"));
      assert.equal(tssPubKey2IndexPost1.y.toString("hex"), tssPubKeyIndex1.y.toString("hex"));
      assert.equal(tssPubKey2IndexPost99.y.toString("hex"), tssPubKeyIndex99.y.toString("hex"));

      // new instance
      const instance3 = await newInstance();
      assert.strictEqual(instance3.getTssFactorPub().length, 1);
    });

    // enable mfa

    await t.test("enable MFA", async function () {
      const instance = await newInstance();
      assert.strictEqual(instance.status, COREKIT_STATUS.LOGGED_IN);

      instance.setTssWalletIndex(1);
      const recoverFactor = await instance.enableMFA({});

      if (testVariable.manualSync) {
        await instance.commitChanges();
      }

      // to prevent rehydration ( rehydrate session id store in BrowserStorage)
      await instance.logout();

      // new instance
      const instance2 = await newInstance();
      assert.strictEqual(instance2.status, COREKIT_STATUS.REQUIRED_SHARE);

      const browserFactor = await instance2.getDeviceFactor();

      // login with mfa factor
      await instance2.inputFactorKey(new BN(recoverFactor, "hex"));
      assert.strictEqual(instance2.status, COREKIT_STATUS.LOGGED_IN);
      await instance2.logout();

      // new instance
      const instance3 = await newInstance();
      assert.strictEqual(instance3.status, COREKIT_STATUS.REQUIRED_SHARE);

      await instance3.inputFactorKey(new BN(browserFactor, "hex"));
      assert.strictEqual(instance3.status, COREKIT_STATUS.LOGGED_IN);
    });
  });
};

const variable: FactorTestVariable[] = [
  { manualSync: true, storage: new MemoryStorage(), email: "testmail1012" },
  { manualSync: false, storage: new MemoryStorage(), email: "testmail1013" },

  { manualSync: true, storage: new AsyncMemoryStorage(), email: "testmail1014" },
  { manualSync: false, storage: new AsyncMemoryStorage(), email: "testmail1015" },
];

variable.forEach(async (testVariable) => {
  await FactorManipulationTest(testVariable);
});
