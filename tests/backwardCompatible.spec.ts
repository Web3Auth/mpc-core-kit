import assert from "node:assert";
import test from "node:test";

import { EllipticPoint } from "@tkey/common-types";
import { UX_MODE_TYPE } from "@toruslabs/customauth";
import { keccak256 } from "@toruslabs/metadata-helpers";
import { tssLib } from "@toruslabs/tss-dkls-lib";
import BN from "bn.js";
import { ec as EC } from "elliptic";

import { AsyncStorage, COREKIT_STATUS, MemoryStorage, sigToRSV, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { bufferToElliptic, mockLogin } from "./setup";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  uxMode: UX_MODE_TYPE | "nodejs";
  manualSync?: boolean;

  email: string;
};

const defaultTestEmail = "backwardcompatible";
const variable: TestVariable[] = [
  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: "nodejs", email: defaultTestEmail },
  // { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT, email: defaultTestEmail },

  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: "nodejs", manualSync: true, email: defaultTestEmail },
  // { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT, manualSync: true, email: defaultTestEmail },
];

const checkLogin = async (coreKitInstance: Web3AuthMPCCoreKit) => {
  const keyDetails = coreKitInstance.getKeyDetails();
  assert.strictEqual(coreKitInstance.status, COREKIT_STATUS.LOGGED_IN);
  assert.strictEqual(keyDetails.requiredFactors, 0);
  const factorkey = coreKitInstance.getCurrentFactorKey();
  await coreKitInstance.tKey.getTSSShare(new BN(factorkey.factorKey, "hex"));
};

variable.forEach((testVariable) => {
  const { web3AuthNetwork, uxMode, manualSync, email } = testVariable;

  const storageInstance = new MemoryStorage();
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

  const coreKitInstance = newCoreKitInstance();

  const testNameSuffix = JSON.stringify(testVariable);
  test(`#Login Test with JWT + logout :  ${testNameSuffix}`, async (t) => {
    t.after(async function () {
      // after all test tear down
    });

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

      const tssPublicPoint = bufferToElliptic(coreKitInstance.getPubKey());
      const { metadataPubKey, tssPubKey } = coreKitInstance.getKeyDetails();
      assert.strictEqual(tssPublicPoint.getX().toString("hex"), "d2869f27c3e226d90b275b008f7dc67b8f4b208900a7b98ecc4e5266807d382c");
      assert.strictEqual(tssPublicPoint.getY().toString("hex"), "15860fd569413eb7f177e655c4bf855f37920b800235de344fdd518196becfe0");

      assert.strictEqual(tssPubKey.x.toString("hex"), "d2869f27c3e226d90b275b008f7dc67b8f4b208900a7b98ecc4e5266807d382c");
      assert.strictEqual(tssPubKey.y.toString("hex"), "15860fd569413eb7f177e655c4bf855f37920b800235de344fdd518196becfe0");

      assert.strictEqual(metadataPubKey.x.toString("hex"), "b3951a441f87ecea4672edc82894ac023316723cf164a93adec72b58a27a1f06");
      assert.strictEqual(metadataPubKey.y.toString("hex"), "3be6c118d94242a650e8aebbefcd37ebeceeb927d0ed51f3d2ba723b8fd2740b");
    });

    await t.test("#relogin ", async function () {
      // reload without rehydrate
      // await coreKitInstance.init({ rehydrate: false });

      // rehydrate
      await coreKitInstance.init({ handleRedirectResult: false });
      await checkLogin(coreKitInstance);

      // logout
      await coreKitInstance.logout();

      // reset the storage
      await new AsyncStorage(coreKitInstance._storageKey, storageInstance).resetStore();

      // rehydrate should fail
      await coreKitInstance.init();
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
    });

    await t.test("#able to sign", async function () {
      const msg = "hello world";
      const msgBuffer = Buffer.from(msg);
      const msgHash = keccak256(msgBuffer);
      const signature = sigToRSV(await coreKitInstance.sign(msgHash, { hashed: true } ));

      const secp256k1 = new EC("secp256k1");
      const pubkey = secp256k1.recoverPubKey(msgHash, signature, signature.v) as EllipticPoint;
      const publicKeyPoint = bufferToElliptic(coreKitInstance.getPubKey());
      assert(pubkey.eq(publicKeyPoint));
    });
  });
});
