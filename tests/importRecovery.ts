/* eslint-disable no-console */

import assert from "node:assert";
import { after, afterEach, describe, it } from "node:test";

import { getPubKeyPoint } from "@tkey-mpc/common-types";
import { UX_MODE } from "@toruslabs/customauth";
import BN from "bn.js";

import { IdTokenLoginParams, TssShareType, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "../src";
import { mockLogin } from "./setup";

require("./setup");

const coreKitInstance = new Web3AuthMPCCoreKit({
  web3AuthClientId: "torus-key-test",
  web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
  baseUrl: "http://localhost:3000",
  uxMode: UX_MODE.REDIRECT,
  storageKey: "mock",
});

describe("import recover tss key", function () {
  it("should work", async function () {
    console.log("test started");
    const email = "testing000080000000099@example.com";

    const { idToken, parsedToken } = await mockLogin(email);

    const idTokenLoginParams = {
      verifier: "torus-test-health",
      verifierId: parsedToken.email,
      idToken,
    } as IdTokenLoginParams;
    await coreKitInstance.init();
    await coreKitInstance.loginWithJWT(idTokenLoginParams);
    console.log(coreKitInstance.state.oAuthKey);

    // const factorKeyDevice = await coreKitInstance.createFactor({
    //   shareType: TssShareType.DEVICE,
    // });

    // const factorKeyRecovery = await coreKitInstance.createFactor({
    //   shareType: TssShareType.RECOVERY,
    // });

    const recoveredTssKey = await coreKitInstance._UNSAFE_exportTssKey();
    // recover key
    // reinitalize corekit
    // await coreKitInstance.logout();
    // const recoveredTssKey = await coreKitInstance.recoverTssKey([factorKeyDevice, factorKeyRecovery]);

    console.log(recoveredTssKey);
    // reinitialize corekit
    const newEmail = "randomen000000000ew";
    const newLogin = await mockLogin(newEmail);

    const newIdTokenLoginParams = {
      verifier: "torus-test-health",
      verifierId: newLogin.parsedToken.email,
      idToken: newLogin.idToken,
    } as IdTokenLoginParams;

    const coreKitInstance2 = new Web3AuthMPCCoreKit({
      web3AuthClientId: "torus-key-test",
      web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
      baseUrl: "http://localhost:3000",
      uxMode: UX_MODE.REDIRECT,
      storageKey: "mock",
    });

    await coreKitInstance2.init();
    await coreKitInstance2.loginWithJWT(newIdTokenLoginParams, recoveredTssKey);

    const exportedTssKey = await coreKitInstance2._UNSAFE_exportTssKey();

    console.log(exportedTssKey);
    console.log(recoveredTssKey);

    // assert.strictEqual(exportedTssKey, recoveredTssKey);
  });

  // it("should be ok", function () {
  //   assert.strictEqual(2, 2);
  // });

  // describe("a nested thing", function () {
  //   it("should work", function () {
  //     assert.strictEqual(3, 3);
  //   });
  // });
  afterEach(function () {
    return console.log("finished running recovery test");
  });
  after(function () {
    return console.log("finished running recovery tests");
  });
});
