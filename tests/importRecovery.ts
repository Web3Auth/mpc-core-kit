/* eslint-disable no-console */

import assert from "node:assert";
import { after, afterEach, describe, it } from "node:test";

import { UX_MODE } from "@toruslabs/customauth";

import { IdTokenLoginParams, TssShareType, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "../src";
import { mockLogin } from "./setup";

// require("./setup");

const coreKitInstance = new Web3AuthMPCCoreKit({
  web3AuthClientId: "torus-key-test",
  web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
  baseUrl: "http://localhost:3000",
  uxMode: UX_MODE.REDIRECT,
  storageKey: "mock",
});

describe("import recover tss key", function () {
  it("should work", async function () {
    const email = "testing00008000000000099@example.com";

    const { idToken, parsedToken } = await mockLogin(email);

    const idTokenLoginParams = {
      verifier: "torus-test-health",
      verifierId: parsedToken.email,
      idToken,
    } as IdTokenLoginParams;
    await coreKitInstance.init();
    await coreKitInstance.loginWithJWT(idTokenLoginParams);

    const factorKeyDevice = await coreKitInstance.createFactor({
      shareType: TssShareType.DEVICE,
    });

    const factorKeyRecovery = await coreKitInstance.createFactor({
      shareType: TssShareType.RECOVERY,
    });

    // recover key
    // reinitalize corekit
    await coreKitInstance.logout();
    const recoveredTssKey = await coreKitInstance.recoverTssKey([factorKeyDevice, factorKeyRecovery]);

    console.log(recoveredTssKey);
    // reinitialize corekit
    const newEmail = "randomen0000000000000ew";
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

    assert.strictEqual(exportedTssKey, recoveredTssKey);
  });

  afterEach(function () {
    return console.log("finished running recovery test");
  });
  after(function () {
    return console.log("finished running recovery tests");
  });
});
