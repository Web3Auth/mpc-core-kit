
import { WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit, TssSecurityQuestion } from "@web3auth/mpc-core-kit";
import { tssLib } from "@toruslabs/tss-dkls-lib";

export const flow = async (params: { selectedNetwork: WEB3AUTH_NETWORK_TYPE, manualSync: boolean, setupProviderOnInit: boolean, verifier: string, verifierId: string, idToken: string }) => {
    const startTime = Date.now();
    console.log("startTime", startTime);

    const coreKitInstance = new Web3AuthMPCCoreKit(
        {
          web3AuthClientId: 'BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ',
          web3AuthNetwork: params.selectedNetwork,
          uxMode: 'redirect',
          manualSync: params.manualSync,
          storage: window.localStorage,
          tssLib,
        }
    );
    
    await coreKitInstance.init({ handleRedirectResult: false, rehydrate: false });
    
    await coreKitInstance.loginWithJWT({
        verifier: params.verifier,
        verifierId: params.verifierId,
        idToken: params.idToken,
        prefetchTssPublicKeys: 2,
    });

    let loggedInTime = Date.now();
    console.log("logged Time :", loggedInTime);
    console.log(loggedInTime - startTime);

    const securityQuestion: TssSecurityQuestion = new TssSecurityQuestion();

    await securityQuestion.setSecurityQuestion({
        mpcCoreKit: coreKitInstance,
        question: "question",
        answer: "answer",
    });

    let SqFactorTime = Date.now();
    console.log("SQ time", SqFactorTime);
    console.log(SqFactorTime - loggedInTime);

    await coreKitInstance.commitChanges();

    let commitTime = Date.now();
    console.log("commit :", commitTime);
    console.log(commitTime - SqFactorTime);

    console.log("total time", commitTime - startTime);
    
    
}
