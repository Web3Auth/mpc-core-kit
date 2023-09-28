/* eslint-disable no-console */
import assert from "node:assert";
import { after, afterEach, describe, it } from "node:test";

import { getPubKeyPoint } from "@tkey-mpc/common-types";
import { UX_MODE } from "@toruslabs/customauth";
import BN from "bn.js";

import { IdTokenLoginParams, parseToken, TssShareType, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "../src";

global.navigator = { userAgent: "test" };
global.window = undefined;
console.log(navigator);

console.log("before all");

const coreKitInstance = new Web3AuthMPCCoreKit({
  web3AuthClientId: "torus-key-test",
  web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
  baseUrl: "http://localhost:3000",
  uxMode: UX_MODE.REDIRECT,
  storageKey: "mock",
});

describe("A thing", function () {
  it("should work", async function () {
    console.log("test started");
    const email = "testing0000899@example.com";

    const req = new Request("https://li6lnimoyrwgn2iuqtgdwlrwvq0upwtr.lambda-url.eu-west-1.on.aws/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ verifier: "torus-key-test", scope: "email", extraPayload: { email }, alg: "ES256" }),
    });

    const resp = await fetch(req);
    const bodyJson = (await resp.json()) as { token: string };
    const idToken = bodyJson.token;
    const parsedToken = parseToken(idToken);

    const idTokenLoginParams = {
      verifier: "torus-test-health",
      verifierId: parsedToken.email,
      idToken,
    } as IdTokenLoginParams;
    await coreKitInstance.init();
    await coreKitInstance.loginWithJWT(idTokenLoginParams);
    console.log(coreKitInstance.state.oAuthKey);

    const factorKey = await coreKitInstance.createFactor({
      shareType: TssShareType.DEVICE,
    });
    console.log(factorKey);
    const factorPub = getPubKeyPoint(new BN(factorKey, "hex"));

    await coreKitInstance.deleteFactor(factorPub, factorKey);

    console.log(coreKitInstance.getKeyDetails());

    assert.strictEqual(1, 1);
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
    return console.log("finished running test");
  });
  after(function () {
    return console.log("finished running tests");
  });
});
