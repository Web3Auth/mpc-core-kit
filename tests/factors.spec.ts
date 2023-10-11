/* eslint-disable mocha/handle-done-callback */
import test from "node:test";

import { UX_MODE } from "@toruslabs/customauth";
import BN from "bn.js";

import { COREKIT_STATUS, Point, TssShareType, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin } from "./setup";

type FactorTestVariable = {
  types: TssShareType;
  manualSync?: boolean;
};

//   const { types } = factor;
export const FactorManipulationTest = async (
  coreKitInstance: Web3AuthMPCCoreKit,
  newInstance: () => Promise<Web3AuthMPCCoreKit>,
  testVariable: FactorTestVariable
) => {
  test(`#Factor manipulation - ${testVariable.types} `, async function (t) {
    await test.before(async function () {
      if (coreKitInstance.status === COREKIT_STATUS.INITIALIZED) await criticalResetAccount(coreKitInstance);
    });
    // create factor
    await t.test("should able to create factor", async function () {
      const factorKey1 = await coreKitInstance.createFactor({
        shareType: testVariable.types,
      });
      const factorKey2 = await coreKitInstance.createFactor({
        shareType: testVariable.types,
      });

      // get current Factor ( default is hash factor)
      const firstFactor = coreKitInstance.getCurrentFactorKey();

      if (testVariable.manualSync) {
        await coreKitInstance.commitChanges();
      }

      console.log("firstFactor", factorKey1);
      // replace active factor key
      await coreKitInstance.inputFactorKey(new BN(factorKey1, "hex"));

      // delete hash factor factor
      const pt = Point.fromPrivateKey(firstFactor.factorKey);
      await coreKitInstance.deleteFactor(pt.toTkeyPoint());
      // try deleted input factor on second instance

      // delete active factor key
      try {
        const activePt = Point.fromPrivateKey(factorKey1);
        await coreKitInstance.deleteFactor(activePt.toTkeyPoint());
        throw new Error("should not reach here");
      } catch {}

      // delete deleted factor key
      try {
        const activePt = Point.fromPrivateKey(factorKey1);
        await coreKitInstance.deleteFactor(activePt.toTkeyPoint());
        throw new Error("should not reach here");
      } catch {}

      // sync
      if (testVariable.manualSync) {
        await coreKitInstance.commitChanges();
      }

      // newInstance
      const instance2 = await newInstance();
      console.log(instance2.state);

      // input factor to second instance
      await instance2.inputFactorKey(new BN(factorKey1));

      // instance
      const tssShare = await instance2.tKey.getTSSShare(new BN(factorKey1));
    });
  });
};

const variable: FactorTestVariable[] = [
  { types: TssShareType.DEVICE, manualSync: true },
  { types: TssShareType.RECOVERY, manualSync: true },
];

const email = "testmail";
variable.forEach(async (testVariable) => {
  const newCoreKitLogInInstance = async () => {
    const instance = new Web3AuthMPCCoreKit({
      web3AuthClientId: "torus-key-test",
      web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
      baseUrl: "http://localhost:3000",
      uxMode: UX_MODE.REDIRECT,
      storageKey: "mock",
      manualSync: testVariable.manualSync,
    });

    const { idToken, parsedToken } = await mockLogin(email);
    await instance.init();
    try {
      await instance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });
    } catch (error) {}

    return instance;
  };

  const coreKitInstance = await newCoreKitLogInInstance();

  FactorManipulationTest(coreKitInstance, newCoreKitLogInInstance, testVariable);
});
