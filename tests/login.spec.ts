/* eslint-disable mocha/handle-done-callback */
import assert, { strictEqual } from "node:assert";
import test from "node:test";

import { UX_MODE_TYPE } from "@toruslabs/customauth";
import { keccak256 } from "@toruslabs/metadata-helpers";
import * as TssLib from "@toruslabs/tss-lib-node";
import BN from "bn.js";
import { ec as EC } from "elliptic";

import { BrowserStorage, COREKIT_STATUS, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin } from "./setup";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  uxMode: UX_MODE_TYPE | "nodejs";
  manualSync?: boolean;

  email: string;
};

const defaultTestEmail = "testEmail1";
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
    threshold: 0,
    accountIndex,
  });
};

variable.forEach((testVariable) => {
  const { web3AuthNetwork, uxMode, manualSync, email } = testVariable;
  const coreKitInstance = new Web3AuthMPCCoreKit({
    web3AuthClientId: "torus-key-test",
    web3AuthNetwork,
    baseUrl: "http://localhost:3000",
    uxMode,
    tssLib: TssLib,
    storageKey: "memory",
    manualSync,
  });

  const testNameSuffix = JSON.stringify(testVariable);
  test(`#Login Test with JWT + logout :  ${testNameSuffix}`, async (t) => {
    t.before(async function () {
      if (coreKitInstance.status === COREKIT_STATUS.INITIALIZED) await criticalResetAccount(coreKitInstance);
      BrowserStorage.getInstance("memory").resetStore();
    });

    t.after(async function () {
      // after all test tear down
    });

    // t.skip("#Login with Oauth", async function () {
    //   // popup
    //   // redirect flow
    //   // not testable
    // });
    await t.test("#Login ", async function () {
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
      const pubKey = coreKitInstance.getTssPublicKey();
      const factorkey = coreKitInstance.getCurrentFactorKey();
      const { tssShare } = await coreKitInstance.tKey.getTSSShare(new BN(factorkey.factorKey, "hex"), {
        threshold: 0,
      });
      // check whether the public key and tss share is same as old sdks
      strictEqual(pubKey.x.toString("hex"), "1f85b9d4fc945dc93739323d65a4dc89060faece4cb90c147a28bb93b01c0cac");
      strictEqual(pubKey.y.toString("hex"), "f286a5912766de74d48cfa38bb1e593053b2cb471504ace3ef6186af584502f8");
      strictEqual(tssShare.toString("hex"), "6252d281ae566243c1c00e8d89414527c1d6634faf489164efa28c5d6adc450a");
    });

    await t.test("#relogin ", async function () {
      // reload without rehydrate
      // await coreKitInstance.init({ rehydrate: false });

      // rehydrate
      await coreKitInstance.init({ handleRedirectResult: false });
      await checkLogin(coreKitInstance);

      // logout
      await coreKitInstance.logout();

      // rehydrate should fail
      await coreKitInstance.init();
      assert.strictEqual(coreKitInstance.status, COREKIT_STATUS.INITIALIZED);
      try {
        coreKitInstance.getCurrentFactorKey();
        throw new Error("should not reach here");
      } catch (error) {}

      // relogin
      const { idToken, parsedToken } = await mockLogin(email);
      await coreKitInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });

      // get key details
      await checkLogin(coreKitInstance);
    });

    await t.test("#able to sign", async function () {
      const msg = "hello world";
      const msgBuffer = Buffer.from(msg);
      const msgHash = keccak256(msgBuffer);
      const signature = await coreKitInstance.sign(msgHash);

      const secp256k1 = new EC("secp256k1");
      const pubkey = secp256k1.recoverPubKey(msgHash, signature, signature.v - 27);
      const publicKeyPoint = coreKitInstance.getTssPublicKey();
      assert.strictEqual(pubkey.x.toString("hex"), publicKeyPoint.x.toString("hex"));
      assert.strictEqual(pubkey.y.toString("hex"), publicKeyPoint.y.toString("hex"));
    });

    await t.test("#Login and sign with different account/wallet index", async function () {
      // mock login with random
      const { idToken: idToken2, parsedToken: parsedToken2 } = await mockLogin();
      await coreKitInstance.init({ handleRedirectResult: false });
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
      const signature1 = await coreKitInstance.sign(msgHash);

      const pubkey1 = secp256k1.recoverPubKey(msgHash, signature1, signature1.v - 27);
      const publicKeyPoint1 = coreKitInstance.getTssPublicKey();
      assert.strictEqual(pubkey1.x.toString("hex"), publicKeyPoint1.x.toString("hex"));
      assert.strictEqual(pubkey1.y.toString("hex"), publicKeyPoint1.y.toString("hex"));

      await coreKitInstance.setTssWalletIndex(1);

      const msg1 = "hello world 2";
      const msgBuffer1 = Buffer.from(msg1);
      const msgHash1 = keccak256(msgBuffer1);

      const signature2 = await coreKitInstance.sign(msgHash1);

      const pubkey2 = secp256k1.recoverPubKey(msgHash1, signature2, signature2.v - 27);
      const publicKeyPoint2 = coreKitInstance.getTssPublicKey();
      assert.strictEqual(pubkey2.x.toString("hex"), publicKeyPoint2.x.toString("hex"));
      assert.strictEqual(pubkey2.y.toString("hex"), publicKeyPoint2.y.toString("hex"));

      await checkLogin(coreKitInstance, 1);

      await coreKitInstance.setTssWalletIndex(2);

      const msg2 = "hello world 3";
      const msgBuffer2 = Buffer.from(msg2);
      const msgHash2 = keccak256(msgBuffer2);
      const signature3 = await coreKitInstance.sign(msgHash2);

      const pubkey3 = secp256k1.recoverPubKey(msgHash2, signature3, signature3.v - 27);
      const publicKeyPoint3 = coreKitInstance.getTssPublicKey();
      assert.strictEqual(pubkey3.x.toString("hex"), publicKeyPoint3.x.toString("hex"));
      assert.strictEqual(pubkey3.y.toString("hex"), publicKeyPoint3.y.toString("hex"));

      await checkLogin(coreKitInstance, 2);
    });
  });
});
