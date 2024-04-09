import { BN } from "bn.js";
import { COREKIT_STATUS, DEFAULT_CHAIN_CONFIG, IdTokenLoginParams, Point, TssSecurityQuestion, TssShareType, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit, getWebBrowserFactor } from "@web3auth/mpc-core-kit";
import { Address } from "@ethereumjs/util";
const PASSWORD_QUESTION = 'what is password';
const selectedNetwork = WEB3AUTH_NETWORK.DEVNET;
// Global variable
let globalSigner: any;
let tKeyPublicKey: any;
let tKeyPrivKey: any;
let walletAddress: any;
let globalRedirectUrl: any;

/**
 * The instance of the Web3AuthMPCCoreKit class.
 * This class is responsible for handling authentication and core functionality related to the login process.
 */
export const coreKitInstance = new Web3AuthMPCCoreKit({
  web3AuthClientId: process.env.REACT_APP_CLIENT_ID ?? "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
  web3AuthNetwork: selectedNetwork,
  uxMode: "redirect",
  enableLogging: false,
  manualSync: true,
  setupProviderOnInit: false,
  disableHashedFactorKey: true,
});

const securityQuestion = new TssSecurityQuestion();
export const upbondinit = async ( idToken: string , parsedToken : { sub: string, wallet_address: any }, verifier: string, subVerifier?:string ) => {
  try {
    try {

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let deviceFactorExist = false;
      let promiseRecoveryKey;

      // Init and loginWithJWT with IdToken
      const jwtLoginOption: IdTokenLoginParams = {
        idToken,
        verifierId: parsedToken.sub,
        verifier
      };
      console.log("idToken", JSON.stringify(idToken));
      console.log("sub", JSON.stringify(parsedToken.sub));
      console.log("wallet_address", JSON.stringify(parsedToken.wallet_address));

      console.time("Execution A");
      console.time("Execution A1");
      if (subVerifier) {
        jwtLoginOption.subVerifier = subVerifier;
      }
      // init can be called before login is triggered, it should excluded from the login time
      await coreKitInstance.init({ handleRedirectResult: false, rehydrate: false });
      console.timeEnd("Execution A1");

      console.time("Execution A2");
      await coreKitInstance.loginWithJWT(jwtLoginOption, { prefetchTssPublicKeys: 2 });
      console.timeEnd("Execution A2");

      console.timeEnd("Execution A");

      console.time("Execution B");

      try {
        console.time("Execution B1");
        try {
          // new user will not have device factor

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const factorKey: any = await getWebBrowserFactor(coreKitInstance!);
          if (factorKey) {
            const factorBnKey = new BN(factorKey, "hex");
            console.log("factorbnkey", JSON.stringify(factorBnKey));
            await coreKitInstance.inputFactorKey(factorBnKey);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            deviceFactorExist = true; // Device factor does exists
          }
        } catch (e) {
          console.log("No device factor key exists");
        }
        console.timeEnd("Execution B1");

        try {
          console.time("Execution B2");
          try {
            const question = securityQuestion.getQuestion(coreKitInstance);
            console.log("@question", question);
          } catch (e) {
            // Security Questions dont exist. Create a new data.
            console.log("No security question factor key exists.. creating one");


            // get wallet address which derive from public key
            walletAddress = Address.fromPublicKey(await coreKitInstance.getPublic()).toString();

            // If address is empty then wait for address first
            // if (!walletAddress) {
            //   // Check provider first if not setup
            //   if (!coreKitInstance.provider) {
            //     if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
            //       await coreKitInstance.setupProvider({ chainConfig: DEFAULT_CHAIN_CONFIG }).then(async () => {
            //         //
            //       });
            //     }
            //   }

            //   // can get address from provider after next login
            //   // if (coreKitInstance.provider) {
            //   //   const ether = new ethers.providers.Web3Provider(coreKitInstance.provider);
            //   //   const signer = ether.getSigner();
            //   //   walletAddress = await signer.getAddress();
            //   // }
            // }
            console.timeEnd("Execution B2");

            console.time("Execution B3");
            console.log("@walletAddress ", JSON.stringify(walletAddress));
            try {
              // // getting publicKey from recovery services
              // const recServiceData: any = await RecoveryServices.getPublicKey(recoveryServiceName);
              // console.log("recServiceData", JSON.stringify(recServiceData));
              // // creating Random six digit passCode for user
              const randomSixDigitNumber = Math.floor(100000 + Math.random() * 900000);
              // // Encrypting Passcode using PublicKey from Recovery Service

              // const encryptedRecoveryKey = await encryptWithRsa(
              //   JSON.stringify({ value: randomSixDigitNumber.toString(), salt: generateRandomString(32), walletAddress }),
              //   recServiceData.data[recServiceData.data.length - 1].publicKey
              // );
              // console.log("@encryptedRecoveryKey ", JSON.stringify(encryptedRecoveryKey));
              // dispatch(olUserModuleAction.setRandomPascode({ randomPascode: randomSixDigitNumber.toString() }));
              // // sent encrypted passcode to Upbond database
              // promiseRecoveryKey = RecoveryServices.sentEncrypted(
              //   encryptedRecoveryKey,
              //   recoveryServiceName,
              //   recServiceData.data[recServiceData.data.length - 1].publicKeyId,
              //   accessToken,
              //   walletAddress
              // );
              console.timeEnd("Execution B3");

              console.time("Execution B4");

              // set Security Question, by using randomSixDigitNumber
              await Promise.all([
                securityQuestion.setSecurityQuestion({
                  mpcCoreKit: coreKitInstance,
                  question: PASSWORD_QUESTION,
                  answer: randomSixDigitNumber.toString(),
                  shareType: TssShareType.RECOVERY
                })
              ]);
              console.timeEnd("Execution B4");
            } catch (e) {
              console.log("Error creating recovery key share", e);

              // Sentry.captureException(e);
            }
          }

          // console.log("@selectedAddress", JSON.stringify(selectedAddress));
        } catch (e) {
          console.log("@error", e);
          // Sentry.captureException(e);
        }

        console.time("Execution B5");
        // Check device factor first before enabling MFA.
        // If not exists, then enableMFA to create the factor
        // if (!deviceFactorExist) {
        //   try {
        //     // await coreKitInstance.enableMFA({});
        //     // // await new Promise((resolve) => setTimeout(resolve, 2000));

        //     // enable mfa ( by deleting Hash Factor )
        //     const browserInfo = bowser.parse(navigator.userAgent);
        //     const browserName = `${browserInfo.browser.name}`;
        //     const browserData = {
        //       browserName,
        //       browserVersion: browserInfo.browser.version,
        //       deviceName: browserInfo.os.name
        //     };
        //     const deviceFactorKey = new BN(
        //       await coreKitInstance.createFactor({
        //         shareType: TssShareType.DEVICE,
        //         additionalMetadata: browserData as Record<string, string>
        //       }),
        //       "hex"
        //     );
        //     storeWebBrowserFactor(deviceFactorKey, coreKitInstance);
        //     // update current Factor key with device factor
        //     await coreKitInstance.inputFactorKey(new BN(deviceFactorKey, "hex"));

        //     // eslint-disable-next-line
        //     const hashFactor = getHashedPrivateKey(coreKitInstance.state.oAuthKey!, process.env.REACT_APP_CLIENT_ID as string);
        //     const hashedFactorPub = getPubKeyPoint(hashFactor);
        //     coreKitInstance.deleteFactor(hashedFactorPub, hashFactor);

        //     console.log("MFA enabled");
        //   } catch (e) {
        //     console.log("MFA already enabled.");

        //     // Sentry.captureException(e);
        //   }
        // }

        console.timeEnd("Execution B5");
      } catch (e) {
        console.log("@error", e);
      }

      console.timeEnd("Execution B");
      console.time("Execution C");

      // provider is not require if sign is not required
      // Check provider first if not setup
      console.log("Provider", coreKitInstance.provider);
      console.log("CoreKit Status", coreKitInstance.status);
      // if (!coreKitInstance.provider) {
      //   if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
      //     await coreKitInstance.setupProvider({ chainConfig: DEFAULT_CHAIN_CONFIG }).then(async () => {
      //       console.log("coreKitInstance.provider is set to get tKey");
      //     });
      //   }
      //   if (coreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) {
      //     console.log("Requires more shares.. cannot sign MPC.");
      //   }
      // }

      console.log("Finishing..");
      if (promiseRecoveryKey) await promiseRecoveryKey;
      if (coreKitInstance.status !== COREKIT_STATUS.REQUIRED_SHARE) await coreKitInstance.commitChanges();

      console.timeEnd("Execution C");
    } catch (error: unknown) {
      console.log("@err", error);
    }
  } catch (error) {
    console.log("@error", error);
  }
};
