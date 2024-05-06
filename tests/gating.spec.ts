/* eslint-disable mocha/handle-done-callback */
import test from "node:test";

import { UX_MODE_TYPE } from "@toruslabs/customauth";
import * as TssLib from "@toruslabs/tss-lib-node";

import { COREKIT_STATUS, MemoryStorage, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin } from "./setup";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  web3ClientID: string;
  uxMode: UX_MODE_TYPE | "nodejs";
  manualSync?: boolean;
  email: string;
  gated?: boolean;
};

const defaultTestEmail = "testEmail1";
const variable: TestVariable[] = [
  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: "nodejs", email: defaultTestEmail, web3ClientID: "torus-key-test" },
  {
    web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET,
    uxMode: "nodejs",
    email: defaultTestEmail,
    web3ClientID: "BJ57yveG_XBLqZUpjtJCnJMrord0AaXpd_9OSy4HzkxpnpPn6Co73h-vR6GEI1VogtW4yMHq13GNPKmVpliFXY0",
  },
  {
    web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET,
    uxMode: "nodejs",
    email: defaultTestEmail,
    web3ClientID: "BCriFlI9ihm81N-bc7x6N-xbqwBLuxfRDMmSH87spKH27QTNOPj1W9s2K3-mp9NzXuaRiqxvAGHyuGlXG5wLD1g",
    gated: true,
  },
];

variable.forEach((testVariable) => {
  const { web3AuthNetwork, uxMode, manualSync, email, web3ClientID: web3AuthClientId, gated } = testVariable;
  const coreKitInstance = new Web3AuthMPCCoreKit({
    web3AuthClientId,
    web3AuthNetwork,
    baseUrl: "http://localhost:3000",
    uxMode,
    tssLib: TssLib,
    storage: new MemoryStorage(),
    manualSync,
  });

  const testNameSuffix = JSON.stringify(testVariable);
  test(`#Gating test :  ${testNameSuffix}`, async (t) => {
    t.before(async function () {
      if (coreKitInstance.status === COREKIT_STATUS.INITIALIZED) await criticalResetAccount(coreKitInstance);
    });

    t.after(async function () {
      // after all test tear down
    });

    await t.test("#Login ", async function () {
      // mocklogin
      const { idToken, parsedToken } = await mockLogin(email);

      try {
        await coreKitInstance.init({ handleRedirectResult: false });
      } catch (error) {
        if (!gated) throw error;
      }
      try {
        await coreKitInstance.loginWithJWT({
          verifier: "torus-test-health",
          verifierId: parsedToken.email,
          idToken,
        });
      } catch (error) {
        if (gated) {
          // if result should gated but error message is not "MPC Core Kit not initialized"
          if (!((error as Error).message as string).includes("MPC Core Kit not initialized")) {
            throw error;
          }
        }
      }
    });
  });
});
