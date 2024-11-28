import assert from "node:assert";
import test from "node:test";

import { EllipticPoint } from "@tkey/common-types";
import { UX_MODE_TYPE } from "@toruslabs/customauth";
import { tssLib } from "@toruslabs/tss-frost-lib-bip340";
import BN from "bn.js";
import { schnorr as bip340 } from '@noble/curves/secp256k1';

import { AsyncStorage, COREKIT_STATUS, MemoryStorage, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { bufferToElliptic, criticalResetAccount, mockLogin, mockLogin2 } from "./setup";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  uxMode: UX_MODE_TYPE | "nodejs";
  manualSync?: boolean;
  email: string;
};

const defaultTestEmail = "testEmailForLoginBip340";
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

  async function resetAccount() {
    const resetInstance = newCoreKitInstance();
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

  const testNameSuffix = JSON.stringify(testVariable);

  let checkPubKey: EllipticPoint;
  let checkTssShare: BN;

  test(`#Login Test with JWT + logout:  ${testNameSuffix}`, async (t) => {
    await resetAccount();
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

      checkPubKey = bufferToElliptic(coreKitInstance.getPubKey(), coreKitInstance.tKey.tssCurve);
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
      const newPubKey = bufferToElliptic(coreKitInstance.getPubKey(), coreKitInstance.tKey.tssCurve);
      const factorkey = coreKitInstance.getCurrentFactorKey();
      const { tssShare: newTssShare } = await coreKitInstance.tKey.getTSSShare(new BN(factorkey.factorKey, "hex"));
      assert(checkPubKey.eq(newPubKey));
      assert(checkTssShare.eq(newTssShare));
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

      const signature = await coreKitInstance.sign(msgBuffer);
      const pk = coreKitInstance.getPubKeyBip340();
      const valid = bip340.verify(signature, msgBuffer, pk);
      assert(valid);
    });
  });
});
