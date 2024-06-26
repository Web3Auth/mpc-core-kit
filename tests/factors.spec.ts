/* eslint-disable mocha/handle-done-callback */
import assert from "node:assert";
import test from "node:test";

import * as TssLib from "@toruslabs/tss-lib-node";
import { log } from "@web3auth/base";
import BN from "bn.js";

import {
  asyncGetFactor,
  COREKIT_STATUS,
  getWebBrowserFactor,
  IAsyncStorage,
  MemoryStorage,
  Point,
  SupportedStorageType,
  TssShareType,
  WEB3AUTH_NETWORK,
  Web3AuthMPCCoreKit,
} from "../src";
import { AsyncMemoryStorage, criticalResetAccount, mockLogin } from "./setup";

type FactorTestVariable = {
  types: TssShareType;
  manualSync?: boolean;
  storage?: SupportedStorageType;
  asyncStorage?: IAsyncStorage;
};

//   const { types } = factor;
export const FactorManipulationTest = async (
  newInstance: (ignoreError?: boolean) => Promise<Web3AuthMPCCoreKit>,
  testVariable: FactorTestVariable
) => {
  test(`#Factor manipulation - ${testVariable.types} `, async function (t) {
    await t.before(async function () {
      const coreKitInstance = await newInstance(true);
      await criticalResetAccount(coreKitInstance);
      await coreKitInstance.logout();
    });

    await t.test("should able to create factor", async function () {
      const coreKitInstance = await newInstance();
      coreKitInstance.setTssWalletIndex(1);

      coreKitInstance.setTssWalletIndex(0);
      const tssPubKeyIndex0 = coreKitInstance.getTssPublicKey();

      coreKitInstance.setTssWalletIndex(1);
      const tssPubKeyIndex1 = coreKitInstance.getTssPublicKey();

      coreKitInstance.setTssWalletIndex(99);
      const tssPubKeyIndex99 = coreKitInstance.getTssPublicKey();

      const firstFactor = coreKitInstance.getCurrentFactorKey();
      // try delete hash factor factor
      try {
        const pt = Point.fromPrivateKey(firstFactor.factorKey);
        await coreKitInstance.deleteFactor(pt.toTkeyPoint());
        throw new Error("should not reach here");
      } catch {}

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
      const pt = Point.fromPrivateKey(factorKey1);
      await instance2.deleteFactor(pt.toTkeyPoint());

      // delete factor
      instance2.setTssWalletIndex(1);
      const pt2 = Point.fromPrivateKey(factorKey2);
      await instance2.deleteFactor(pt2.toTkeyPoint());

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
      instance.setTssWalletIndex(1);
      const recoverFactor = await instance.enableMFA({});

      if (testVariable.manualSync) {
        await instance.commitChanges();
      }

      // to prevent rehydration ( rehydrate session id store in BrowserStorage)
      await instance.logout();

      // new instance
      const instance2 = await newInstance();

      let browserFactor;
      if (testVariable.storage) {
        browserFactor = await getWebBrowserFactor(instance2, testVariable.storage);
      } else {
        browserFactor = await asyncGetFactor(instance2, testVariable.asyncStorage);
      }

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
  { types: TssShareType.DEVICE, manualSync: true, storage: new MemoryStorage() },
  { types: TssShareType.RECOVERY, manualSync: true, storage: "memory" },

  { types: TssShareType.RECOVERY, manualSync: true, asyncStorage: new AsyncMemoryStorage() },
  { types: TssShareType.RECOVERY, manualSync: false, asyncStorage: new AsyncMemoryStorage() },
];

const email = "testmail102";
variable.forEach(async (testVariable) => {
  const newCoreKitLogInInstance = async (ignoreError: boolean) => {
    const instance = new Web3AuthMPCCoreKit({
      web3AuthClientId: "torus-key-test",
      web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
      baseUrl: "http://localhost:3000",
      uxMode: "nodejs",
      tssLib: TssLib,
      storageKey: testVariable.storage,
      asyncStorageKey: testVariable.asyncStorage,
      manualSync: testVariable.manualSync,
    });

    const { idToken, parsedToken } = await mockLogin(email);
    await instance.init({ handleRedirectResult: false, rehydrate: false });
    try {
      await instance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });
    } catch (e) {
      // handle error
      if (!ignoreError) {
        throw e;
      }
      log.error(e);
    }

    return instance;
  };

  await FactorManipulationTest(newCoreKitLogInInstance, testVariable);
});
