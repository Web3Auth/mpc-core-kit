import assert from "node:assert";
import test from "node:test";

import { UX_MODE_TYPE } from "@toruslabs/customauth";
import { tssLib } from "@toruslabs/tss-dkls-lib";

import { COREKIT_STATUS, MemoryStorage, WEB3AUTH_NETWORK, WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../src";
import { criticalResetAccount, mockLogin } from "./setup";

type TestVariable = {
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  web3ClientID: string;
  uxMode: UX_MODE_TYPE | "nodejs";
  manualSync?: boolean;
  email: string;
  gated?: boolean;
  sessionTime?: number;
  disableSessionManager?: boolean;
};

const defaultTestEmail = "testEmail1";

const isBasePlan = (id: string) => id === "BCriFlI9ihm81N-bc7x6N-xbqwBLuxfRDMmSH87spKH27QTNOPj1W9s2K3-mp9NzXuaRiqxvAGHyuGlXG5wLD1g";
// BasePlan up to 1 day only
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
  {
    web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET,
    uxMode: "nodejs",
    email: defaultTestEmail,
    web3ClientID: "BJ57yveG_XBLqZUpjtJCnJMrord0AaXpd_9OSy4HzkxpnpPn6Co73h-vR6GEI1VogtW4yMHq13GNPKmVpliFXY0",
    sessionTime: 7200,
    disableSessionManager : false
  },

  {
    web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET,
    uxMode: "nodejs",
    email: defaultTestEmail,
    web3ClientID: "BJ57yveG_XBLqZUpjtJCnJMrord0AaXpd_9OSy4HzkxpnpPn6Co73h-vR6GEI1VogtW4yMHq13GNPKmVpliFXY0",
    sessionTime: 7200,
    disableSessionManager : true
  },
];

variable.forEach(async (testVariable) => {
  const { web3AuthNetwork, uxMode, manualSync, email, web3ClientID: web3AuthClientId, sessionTime, disableSessionManager } = testVariable;
  

  await test(`#Variable SessionTime test :  ${JSON.stringify({ sessionTime: testVariable.sessionTime })} - disableSessionManager: ${disableSessionManager} client_id: ${web3AuthClientId}`, async (t) => {
    let coreKitInstance : Web3AuthMPCCoreKit;

    async function beforeTest() {
      coreKitInstance  = new Web3AuthMPCCoreKit({
        web3AuthClientId,
        web3AuthNetwork,
        baseUrl: "http://localhost:3000",
        uxMode,
        tssLib,
        storage: new MemoryStorage(),
        manualSync,
        sessionTime,
        disableSessionManager,
      });
      if (coreKitInstance.status === COREKIT_STATUS.INITIALIZED) await criticalResetAccount(coreKitInstance);
    }

    t.after(async function () {
      // after all test tear down
      if (!isBasePlan(web3AuthClientId)) await coreKitInstance.logout();
    });

    await beforeTest();

    await t.test("`sessionTime` should be equal to `sessionTokenDuration` from #Login", async function (t) {
      // mocklogin
      const { idToken, parsedToken } = await mockLogin(email);

      await coreKitInstance.init({ handleRedirectResult: false }).catch((err) => {
        if ( !isBasePlan(testVariable.web3ClientID) ) {
          throw err;
        }
      });

      await coreKitInstance.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      }).catch((err) => {
        if ( !isBasePlan(testVariable.web3ClientID) ) {
          throw err;
        }
      });
      if ( !isBasePlan(testVariable.web3ClientID) ) {
        // skip remaining test if is BasePlan
        return;
      }
      
      (await coreKitInstance.getSessionSignatures()).forEach((sig) => {
        const parsedSig = JSON.parse(sig);
        const parsedSigData = JSON.parse(atob(parsedSig.data));

        const sessionTokenDuration = parsedSigData.exp - Math.floor(Date.now() / 1000);
        // in success case, sessionTimeDiff (diff between provided sessionTime and generated session token duration from sss-service)
        // should not be more than 3s(supposed 3s as the network latency)
        const sessionTimeDiff = Math.abs(sessionTokenDuration - sessionTime);
        assert.strictEqual(sessionTimeDiff <= 3, true);
      });

      if (disableSessionManager) {
        assert.equal(coreKitInstance.sessionId , undefined); 
      } else {
        assert.notEqual(coreKitInstance.sessionId , undefined);
      }
    });
  });
});
