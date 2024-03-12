
import { WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit, TssSecurityQuestion } from "@web3auth/mpc-core-kit";
import BN from "bn.js";

export const flow = async (params: { selectedNetwork: WEB3AUTH_NETWORK_TYPE, manualSync: boolean, setupProviderOnInit: boolean, verifier: string, verifierId: string, idToken: string }) => {

    const initStart = Date.now();
    console.log("initStart", initStart);
    const web3AuthClientId = "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ";
    const coreKitInstance = new Web3AuthMPCCoreKit(
        {
          web3AuthClientId,
          web3AuthNetwork: params.selectedNetwork,
          uxMode: 'redirect',
          manualSync: params.manualSync,
          setupProviderOnInit: params.setupProviderOnInit,
          disableHashedFactorKey: true,
        }
    );
    // init can be called before login is triggered, should it is excluded from the login time
    await coreKitInstance.init({ handleRedirectResult: false, rehydrate: false });
    const startTime = Date.now();  
    console.log("done init", startTime);  


    console.log("init", startTime - initStart);
    
    console.log("startTime", startTime); 
    await coreKitInstance.loginWithJWT({
        verifier: params.verifier,
        verifierId: params.verifierId,
        idToken: params.idToken,
    }, { prefetchTssPublicKeys: 3});

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

    console.log("total login time", commitTime - startTime);
    
    
}