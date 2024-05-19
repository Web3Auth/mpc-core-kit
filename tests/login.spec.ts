/* eslint-disable mocha/handle-done-callback */
import assert, { strictEqual } from "node:assert";
import test from "node:test";

import { Point } from "@tkey/common-types";
import { UX_MODE_TYPE } from "@toruslabs/customauth";
import { keccak256 } from "@toruslabs/metadata-helpers";
import { tssLib } from "@toruslabs/tss-dkls-lib";
import BN from "bn.js";
import { ec as EC } from "elliptic";

import { BrowserStorage, COREKIT_STATUS, MemoryStorage, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin, mockLogin2, stringGen } from "./setup";
import { sigToRSV } from "./util";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  uxMode: UX_MODE_TYPE | "nodejs";
  manualSync?: boolean;

  email: string;
};

const defaultTestEmail = "testEmailForLogin";
const variable: TestVariable[] = [
  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: "nodejs", email: defaultTestEmail },
  // { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT, email: defaultTestEmail },

  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: "nodejs", manualSync: true, email: defaultTestEmail },
  // { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT, manualSync: true, email: defaultTestEmail },
];

const checkLogin = async (coreKitInstance: Web3AuthMPCCoreKit, accountIndex = 0) => {
  const keyDetails = coreKitInstance.getKeyDetails();
  assert.strictEqual(coreKitInstance.status, COREKIT_STATUS.LOGGED_IN);
  assert.strictEqual(keyDetails.requiredFactors, 0);
  const factorkey = coreKitInstance.getCurrentFactorKey();
  await coreKitInstance.tKey.getTSSShare(new BN(factorkey.factorKey, "hex"), {
    accountIndex,
  });
};

const storageInstance = new MemoryStorage();

variable.forEach((testVariable) => {
  const { web3AuthNetwork, uxMode, manualSync, email } = testVariable;
  const newCoreKitInstance = () =>
    new Web3AuthMPCCoreKit({
      web3AuthClientId: "torus-key-test",
      web3AuthNetwork,
      baseUrl: "http://localhost:3000",
      uxMode,
      tssLib,
      storage: storageInstance,
      manualSync,
    });

  const testNameSuffix = JSON.stringify(testVariable);

  let checkPubKey: Point;
  let checkTssShare: BN;

  test(`#Login Test with JWT + logout :  ${testNameSuffix}`, async (t) => {
    async function beforeTest() {
      const resetInstance = new Web3AuthMPCCoreKit({
        web3AuthClientId: "torus-key-test",
        web3AuthNetwork,
        baseUrl: "http://localhost:3000",
        uxMode,
        tssLib,
        storage: storageInstance,
        manualSync,
      });
      const { idToken, parsedToken } = await mockLogin(email);
      await resetInstance.init({ handleRedirectResult: false, rehydrate: false });
      await resetInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });
      await criticalResetAccount(resetInstance);
      await new AsyncStorage(resetInstance._storageKey, storageInstance).resetStore();
    }

    await beforeTest();
    await t.test("#Login", async function () {
      const coreKitInstance = newCoreKitInstance();

      // mocklogin
      const { idToken, parsedToken } = await mockLogin(email);
      await coreKitInstance.init({ handleRedirectResult: false });
      await coreKitInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });
      // get key details
      await checkLogin(coreKitInstance);

      checkPubKey = coreKitInstance.getTssPublicKey();
      const factorkey = coreKitInstance.getCurrentFactorKey();
      const { tssShare } = await coreKitInstance.tKey.getTSSShare(new BN(factorkey.factorKey, "hex"), {
        threshold: 0,
      });
      checkTssShare = tssShare;

      if (manualSync) {
        await coreKitInstance.commitChanges();
      }
      // check whether the public key and tss share is same as old sdks
    });

    await t.test("#relogin ", async function () {
      const coreKitInstance = newCoreKitInstance();
      // rehydrate
      await coreKitInstance.init({ handleRedirectResult: false });
      await checkLogin(coreKitInstance);

      // logout
      await coreKitInstance.logout();

      // rehydrate should fail
      await coreKitInstance.init({
        rehydrate: false,
        handleRedirectResult: false,
      });
      assert.strictEqual(coreKitInstance.status, COREKIT_STATUS.INITIALIZED);
      assert.throws(() => coreKitInstance.getCurrentFactorKey());

      // relogin
      const { idToken, parsedToken } = await mockLogin(email);
      await coreKitInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });

      // get key details
      await checkLogin(coreKitInstance);
      const newPubKey = coreKitInstance.getTssPublicKey();
      const factorkey = coreKitInstance.getCurrentFactorKey();
      const { tssShare: newTssShare } = await coreKitInstance.tKey.getTSSShare(new BN(factorkey.factorKey, "hex"));
      strictEqual(checkPubKey.x.toString("hex"), newPubKey.x.toString("hex"));
      strictEqual(checkPubKey.y.toString("hex"), newPubKey.y.toString("hex"));
      strictEqual(checkTssShare.toString("hex"), newTssShare.toString("hex"));
    });

    await t.test("#able to sign", async function () {
      const coreKitInstance = newCoreKitInstance();
      await coreKitInstance.init({ handleRedirectResult: false, rehydrate: false });
      const localToken = await mockLogin2(email);
      await coreKitInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: email,
        idToken: localToken.idToken,
      });
      const msg = "hello world";
      const msgBuffer = Buffer.from(msg);
      const msgHash = keccak256(msgBuffer);
      const secp256k1 = new EC("secp256k1");

      // Sign hash.
      const signature = sigToRSV(await coreKitInstance.sign(msgHash, true));
      const pubkey = secp256k1.recoverPubKey(msgHash, signature, signature.v - 27);
      const publicKeyPoint = coreKitInstance.getTssPublicKey();
      assert.strictEqual(pubkey.x.toString("hex"), publicKeyPoint.x.toString("hex"));
      assert.strictEqual(pubkey.y.toString("hex"), publicKeyPoint.y.toString("hex"));

      // Sign full message.
      const signature2 = sigToRSV(await coreKitInstance.sign(msgBuffer));
      const pubkey2 = secp256k1.recoverPubKey(msgHash, signature2, signature2.v - 27);
      assert.strictEqual(pubkey2.x.toString("hex"), publicKeyPoint.x.toString("hex"));
      assert.strictEqual(pubkey2.y.toString("hex"), publicKeyPoint.y.toString("hex"));
    });

    await t.test("#Login and sign with different account/wallet index", async function () {
      const vid = stringGen(10);
      const coreKitInstance = newCoreKitInstance();
      // mock login with random
      const { idToken: idToken2, parsedToken: parsedToken2 } = await mockLogin(vid);
      await coreKitInstance.init({ handleRedirectResult: false, rehydrate: false });
      await coreKitInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken2.email,
        idToken: idToken2,
      });

      const secp256k1 = new EC("secp256k1");
      await coreKitInstance.setTssWalletIndex(0);

      const msg = "hello world 1";
      const msgBuffer = Buffer.from(msg);
      const msgHash = keccak256(msgBuffer);
      const signature1 = sigToRSV(await coreKitInstance.sign(msgHash, true));

      const pubkeyIndex0 = secp256k1.recoverPubKey(msgHash, signature1, signature1.v);
      const publicKeyPoint0 = coreKitInstance.getTssPublicKey();
      assert.strictEqual(pubkeyIndex0.x.toString("hex"), publicKeyPoint0.x.toString("hex"));
      assert.strictEqual(pubkeyIndex0.y.toString("hex"), publicKeyPoint0.y.toString("hex"));

      await coreKitInstance.setTssWalletIndex(1);

      const msg1 = "hello world 2";
      const msgBuffer1 = Buffer.from(msg1);
      const msgHash1 = keccak256(msgBuffer1);

      const signature2 = sigToRSV(await coreKitInstance.sign(msgHash1, true));

      const pubkeyIndex1 = secp256k1.recoverPubKey(msgHash1, signature2, signature2.v);
      const publicKeyPoint1 = coreKitInstance.getTssPublicKey();
      assert.strictEqual(pubkeyIndex1.x.toString("hex"), publicKeyPoint1.x.toString("hex"));
      assert.strictEqual(pubkeyIndex1.y.toString("hex"), publicKeyPoint1.y.toString("hex"));

      await checkLogin(coreKitInstance, 1);

      await coreKitInstance.setTssWalletIndex(2);

      const msg2 = "hello world 3";
      const msgBuffer2 = Buffer.from(msg2);
      const msgHash2 = keccak256(msgBuffer2);
      const signature3 = sigToRSV(await coreKitInstance.sign(msgHash2, true));

      const pubkeyIndex2 = secp256k1.recoverPubKey(msgHash2, signature3, signature3.v);
      const publicKeyPoint2 = coreKitInstance.getTssPublicKey();
      assert.strictEqual(pubkeyIndex2.x.toString("hex"), publicKeyPoint2.x.toString("hex"));
      assert.strictEqual(pubkeyIndex2.y.toString("hex"), publicKeyPoint2.y.toString("hex"));

      await checkLogin(coreKitInstance, 2);

      assert.notEqual(publicKeyPoint0.x.toString("hex"), publicKeyPoint1.x.toString("hex"));
      assert.notEqual(publicKeyPoint0.x.toString("hex"), publicKeyPoint2.x.toString("hex"));
      assert.notEqual(publicKeyPoint1.x.toString("hex"), publicKeyPoint2.x.toString("hex"));

      assert.notEqual(publicKeyPoint0.y.toString("hex"), publicKeyPoint1.y.toString("hex"));
      assert.notEqual(publicKeyPoint0.y.toString("hex"), publicKeyPoint2.y.toString("hex"));
      assert.notEqual(publicKeyPoint1.y.toString("hex"), publicKeyPoint2.y.toString("hex"));

      if (manualSync) {
        await coreKitInstance.commitChanges();
      }
      const coreKitInstance3 = newCoreKitInstance();
      // mock login with random
      const { idToken: idToken3, parsedToken: parsedToken3 } = await mockLogin(vid);
      await coreKitInstance3.init({ handleRedirectResult: false, rehydrate: false });
      await coreKitInstance3.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken3.email,
        idToken: idToken3,
      });

      coreKitInstance.setTssWalletIndex(0);
      const pubkey3index0 = coreKitInstance3.getTssPublicKey();
      coreKitInstance3.setTssWalletIndex(1);
      const pubkey3index1 = coreKitInstance3.getTssPublicKey();
      coreKitInstance3.setTssWalletIndex(2);
      const pubkey3index2 = coreKitInstance3.getTssPublicKey();

      assert.strictEqual(pubkeyIndex0.x.toString("hex"), pubkey3index0.x.toString("hex"));
      assert.strictEqual(pubkeyIndex0.y.toString("hex"), pubkey3index0.y.toString("hex"));

      assert.strictEqual(pubkeyIndex1.x.toString("hex"), pubkey3index1.x.toString("hex"));
      assert.strictEqual(pubkeyIndex1.y.toString("hex"), pubkey3index1.y.toString("hex"));

      assert.strictEqual(pubkeyIndex2.x.toString("hex"), pubkey3index2.x.toString("hex"));
      assert.strictEqual(pubkeyIndex2.y.toString("hex"), pubkey3index2.y.toString("hex"));
    });
  });
});
