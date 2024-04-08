/* eslint-disable mocha/handle-done-callback */
import assert from "node:assert";
import test from "node:test";

import { UX_MODE_TYPE } from "@toruslabs/customauth";
import * as TssLib from "@toruslabs/tss-lib-node";

import { COREKIT_STATUS, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin } from "./setup";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  web3ClientID: string;
  uxMode: UX_MODE_TYPE | "nodejs";
  manualSync?: boolean;
  email: string;
  gated?: boolean;
  sessionTime?: number;
};

const defaultTestEmail = "testEmail1";
const variable: TestVariable[] = [
  { web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: "nodejs", email: defaultTestEmail, web3ClientID: "torus-key-test", sessionTime: 3600 },
  {
    web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET,
    uxMode: "nodejs",
    email: defaultTestEmail,
    web3ClientID: "BJ57yveG_XBLqZUpjtJCnJMrord0AaXpd_9OSy4HzkxpnpPn6Co73h-vR6GEI1VogtW4yMHq13GNPKmVpliFXY0",
    sessionTime: 7200,
  },
  {
    web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET,
    uxMode: "nodejs",
    email: defaultTestEmail,
    web3ClientID: "BCriFlI9ihm81N-bc7x6N-xbqwBLuxfRDMmSH87spKH27QTNOPj1W9s2K3-mp9NzXuaRiqxvAGHyuGlXG5wLD1g",
    sessionTime: 172800,
  },
];

variable.forEach((testVariable) => {
  const { web3AuthNetwork, uxMode, manualSync, email, web3ClientID: web3AuthClientId, sessionTime } = variable[0];
  const coreKitInstance = new Web3AuthMPCCoreKit({
    web3AuthClientId,
    web3AuthNetwork,
    baseUrl: "http://localhost:3000",
    uxMode,
    tssLib: TssLib,
    storageKey: "memory",
    manualSync,
    sessionTime,
  });

  test(`#Variable SessionTime test :  ${JSON.stringify({ sessionTime: testVariable.sessionTime })}`, async (t) => {
    t.before(async function () {
      if (coreKitInstance.status === COREKIT_STATUS.INITIALIZED) await criticalResetAccount(coreKitInstance);
    });

    t.after(async function () {
      // after all test tear down
      await coreKitInstance.logout();
    });

    await t.test("`sessionTime` should be equal to `sessionTokenDuration` from #Login", async function () {
      // mocklogin
      const { idToken, parsedToken } = await mockLogin(email);

      await coreKitInstance.init({ handleRedirectResult: false });

      await coreKitInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });

      coreKitInstance.signatures.forEach((sig) => {
        const parsedSig = JSON.parse(sig);
        const parsedSigData = JSON.parse(atob(parsedSig.data));

        const sessionTokenDuration = parsedSigData.exp - Math.floor(Date.now() / 1000);
        // in success case, sessionTimeDiff (diff between provided sessionTime and generated session token duration from sss-service)
        // should not be more than 3s(supposed 3s as the network latency)
        const sessionTimeDiff = Math.abs(sessionTokenDuration - sessionTime);
        assert.strictEqual(sessionTimeDiff <= 3, true);
      });
    });
  });
});
