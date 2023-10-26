/* eslint-disable mocha/handle-done-callback */
/* eslint-disable no-console */
import assert from "node:assert";
import test from "node:test";

// import { getPubKeyPoint } from "@tkey-mpc/common-types";
import { UX_MODE_TYPE } from "@toruslabs/customauth";
import * as TssLib from "@toruslabs/tss-lib-node";
import BN from "bn.js";

import { COREKIT_STATUS, TssSecurityQuestion, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin } from "./setup";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  uxMode: UX_MODE_TYPE | "nodejs";
  manualSync?: boolean;
};

export const TssSecurityQuestionsTest = async (newInstance: () => Promise<Web3AuthMPCCoreKit>, testVariable: TestVariable) => {
  test(`#Tss Security Question - ${testVariable.manualSync} `, async function (t) {
    await t.before(async function () {
      const coreKitInstance = await newInstance();
      if (coreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) await criticalResetAccount(coreKitInstance);
      await coreKitInstance.logout();
    });
    t.afterEach(function () {
      return console.log("finished running test");
    });
    t.after(function () {
      return console.log("finished running tests");
    });

    await t.test("should work", async function () {
      // set security question
      const instance = await newInstance();
      const question = "test question";
      const answer = "test answer";
      const newQuestion = "new question";
      const newAnswer = "new answer";
      // const shareType = TssShareType.DEVICE;

      const securityQuestion = new TssSecurityQuestion();
      await securityQuestion.setSecurityQuestion({
        mpcCoreKit: instance,
        question,
        answer,
        // shareType,
      });

      // recover factor
      const factor = await securityQuestion.recoverFactor(instance, answer);
      // check factor
      await instance.tKey.getTSSShare(new BN(factor, "hex"));
      // check wrong answer
      try {
        await securityQuestion.recoverFactor(instance, "wrong answer");
        throw new Error("should not reach here");
      } catch {}

      // change factor
      await securityQuestion.changeSecurityQuestion({
        mpcCoreKit: instance,
        newQuestion,
        newAnswer,
        answer,
      });
      // recover factor
      // check factor
      const newFactor = await securityQuestion.recoverFactor(instance, newAnswer);
      await instance.tKey.getTSSShare(new BN(newFactor, "hex"));

      try {
        await instance.tKey.getTSSShare(new BN(factor, "hex"));
        throw new Error("should not reach here");
      } catch {}

      // recover factor
      // check wrong answer
      try {
        await securityQuestion.recoverFactor(instance, answer);
        throw new Error("should not reach here");
      } catch {}

      // delete factor
      await securityQuestion.deleteSecurityQuestion(instance);
      // recover factor
      try {
        await securityQuestion.recoverFactor(instance, answer);
        throw new Error("should not reach here");
      } catch {}

      // input factor
      assert.strictEqual(true, true);
    });
  });
};

const variable: TestVariable[] = [
  // { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: UX_MODE.REDIRECT },
  // { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT },

  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: "nodejs", manualSync: true },
  // { web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET, uxMode: UX_MODE.REDIRECT, manualSync: true },
];

const email = "testmail99";

variable.forEach(async (testVariable) => {
  const newCoreKitLogInInstance = async () => {
    const instance = new Web3AuthMPCCoreKit({
      web3AuthClientId: "torus-key-test",
      web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
      baseUrl: "http://localhost:3000",
      uxMode: "nodejs",
      tssLib: TssLib,
      storageKey: "memory",
      manualSync: testVariable.manualSync,
    });

    const { idToken, parsedToken } = await mockLogin(email);
    await instance.init({ handleRedirectResult: false });
    try {
      await instance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });
    } catch (error) {}

    return instance;
  };

  await TssSecurityQuestionsTest(newCoreKitLogInInstance, testVariable);
});
