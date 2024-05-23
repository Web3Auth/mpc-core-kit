import assert from "node:assert";
import test from "node:test";

import { Point, secp256k1 } from "@tkey/common-types";
import { tssLib as tssLibDKLS } from "@toruslabs/tss-dkls-lib";
import { tssLib as tssLibFROST } from "@toruslabs/tss-frost-lib";
import { log } from "@web3auth/base";
import { BN } from "bn.js";

import { AsyncStorage, IdTokenLoginParams, MemoryStorage, TssLib, TssShareType, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "../src";
import { LoginFunc, bufferToElliptic, criticalResetAccount, mockLogin, mockLogin2, newCoreKitLogInInstance } from "./setup";

type TestVariables = {
  manualSync?: boolean;
  email: string;
  importKeyEmail: string;
  tssLib: TssLib;
};

const storageInstance = new MemoryStorage();
export const DebugPostBoxKeyTest = async (testVariable: TestVariables) => {
  async function newCoreKitInstance(email: string, login?: LoginFunc) {
    return newCoreKitLogInInstance({
      network: WEB3AUTH_NETWORK.DEVNET,
      manualSync: testVariable.manualSync,
      email: email,
      storageInstance,
      tssLib: testVariable.tssLib,
      login,
    });
  }

  test(`debug postboxkey: ${testVariable.manualSync}`, async function (t) {
    // Login.
    let instance = await newCoreKitInstance(testVariable.email);
    console.log("postBoxKey", instance.state.oAuthKey);

    // Reset and logout.
    await criticalResetAccount(instance);
    await instance.logout();
    console.log("reset");

    // Login again.
    instance = await newCoreKitInstance(testVariable.email);
    console.log("postBoxKey", instance.state.oAuthKey);

    // Reset and logout.
    await criticalResetAccount(instance);
    await instance.logout();
    console.log("reset");

    // Login again.
    instance = await newCoreKitInstance(testVariable.email, mockLogin2);
    console.log("postBoxKey", instance.state.oAuthKey);

    // Reset and logout.
    await criticalResetAccount(instance);
    await instance.logout();
    console.log("reset");

    // Login again.
    instance = await newCoreKitInstance(testVariable.email, mockLogin2);
    console.log("postBoxKey", instance.state.oAuthKey);
  });
};

const variable: TestVariables[] = [
  // TODO enable again
  // { manualSync: false, email: "emailexport", importKeyEmail: "emailimport", tssLib: tssLibDKLS },
  // { manualSync: true, email: "emailexport", importKeyEmail: "emailimport", tssLib: tssLibDKLS },
  { manualSync: false, email: "emailexport_ed25519", importKeyEmail: "emailimport_ed25519", tssLib: tssLibFROST },
];

variable.forEach(async (testVariable) => {
  await DebugPostBoxKeyTest(testVariable);
});
