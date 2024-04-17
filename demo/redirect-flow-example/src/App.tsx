import { useEffect, useState } from "react";
import {
  Web3AuthMPCCoreKit,
  WEB3AUTH_NETWORK,
  SubVerifierDetailsParams,
  getWebBrowserFactor,
  COREKIT_STATUS,
  TssSecurityQuestion,
  parseToken,
  DEFAULT_CHAIN_CONFIG,
  mnemonicToKey,
} from "@web3auth/mpc-core-kit";
import Web3 from "web3";
import type { provider } from "web3-core";

import "./App.css";
import { SafeEventEmitterProvider } from "@web3auth/base";
import { BN } from "bn.js";

import jwt, { Algorithm } from "jsonwebtoken";
import { flow } from "./flow";
import LoggedinView from "./LoggedinView";
import { CHAIN_CONFIGS, CHAIN_NAMESPACE } from "./utils";

const uiConsole = (...args: any[]): void => {
  const el = document.querySelector("#console>p");
  if (el) {
    el.innerHTML = JSON.stringify(args || {}, null, 2);
  }
  console.log(...args);
};

const selectedNetwork = WEB3AUTH_NETWORK.DEVNET;
// performance options
// const options = {
//   manualSync: true,
//   prefetchTssPub: 2,
//   setupProvdiverOnInit: false,
// }

let coreKitInstance = new Web3AuthMPCCoreKit({
  web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
  web3AuthNetwork: selectedNetwork,
  uxMode: "redirect",
  manualSync: true,
  setupProviderOnInit: false,
  // sessionTime: 3600, // <== can provide variable session time based on user subscribed plan
});

const privateKey = "MEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCCD7oLrcKae+jVZPGx52Cb/lKhdKxpXjl9eGNa1MlY57A==";
const jwtPrivateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
const alg: Algorithm = "ES256";
export const mockLogin = async (email: string) => {
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "torus-key-test",
    aud: "torus-key-test",
    name: email,
    email,
    scope: "email",
    iat,
    eat: iat + 120,
  };

  const algo = {
    expiresIn: 120,
    algorithm: alg,
  };
  console.log("payload", payload);
  const token = jwt.sign(payload, jwtPrivateKey, algo);
  const idToken = token;
  const parsedToken = parseToken(idToken);
  return { idToken, parsedToken };
};

function App() {
  const [mockEmail, setMockEmail] = useState<string>("testuser@corp.com");

  const [backupFactorKey, setBackupFactorKey] = useState<string>("");
  const [deviceFactorKey, setDeviceFactorKey] = useState<string>("");
  const [recoveryFactor, setRecoveryFactor] = useState<string>("");
  const [provider, setProvider] = useState<SafeEventEmitterProvider | null>(null);
  const [web3, setWeb3] = useState<any>(undefined);
  const [coreKitStatus, setCoreKitStatus] = useState<COREKIT_STATUS>(COREKIT_STATUS.NOT_INITIALIZED);
  const [answer, setAnswer] = useState<string | undefined>(undefined);
  const [question, setQuestion] = useState<string | undefined>(undefined);

  const securityQuestion: TssSecurityQuestion = new TssSecurityQuestion();

  // decide whether to rehydrate session
  const rehydrate = true;
  useEffect(() => {
    const init = async () => {
      // Example config to handle redirect result manually
      await coreKitInstance.init({ handleRedirectResult: false, rehydrate });
      if (window.location.hash.includes("#state")) {
        await coreKitInstance.handleRedirectResult();
      }

      if (coreKitInstance.provider) {
        setProvider(coreKitInstance.provider);
      } else {
        if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
          coreKitInstance.setupProvider({ chainConfig: DEFAULT_CHAIN_CONFIG }).then(() => {
            setProvider(coreKitInstance.provider);
          });
        }
      }

      if (coreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) {
        uiConsole(
          "required more shares, please enter your backup/ device factor key, or reset account unrecoverable once reset, please use it with caution]"
        );
      }

      console.log("coreKitInstance.status", coreKitInstance.status);
      setCoreKitStatus(coreKitInstance.status);

      try {
        let result = securityQuestion.getQuestion(coreKitInstance!);
        setQuestion(result);
      } catch (e) {
        setQuestion(undefined);
        uiConsole(e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (provider) {
      const web3 = new Web3(provider as provider);
      setWeb3(web3);
    }
  }, [provider]);

  const loginWithMock = async () => {
    try {
      if (!mockEmail) {
        throw new Error("mockEmail not found");
      }
      const { idToken, parsedToken } = await mockLogin(mockEmail);
      await coreKitInstance.loginWithJWT(
        {
          verifier: "torus-test-health",
          verifierId: parsedToken.email,
          idToken,
        },
        { prefetchTssPublicKeys: 1 }
      );
      console.log('coreKitInstance.status', coreKitInstance.status);
      setCoreKitStatus(coreKitInstance.status);

      if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await setUpProvider();
      }
    } catch (error: unknown) {
      console.error(error);
    }
  };

  const setUpProvider = async () => {
    if (!coreKitInstance.provider) {
      await coreKitInstance.setupProvider({ chainConfig: DEFAULT_CHAIN_CONFIG });
    }
    setProvider(coreKitInstance.provider);
  }

  const timedFlow = async () => {
    try {
      if (!mockEmail) {
        throw new Error("mockEmail not found");
      }
      const { idToken, parsedToken } = await mockLogin(mockEmail);
      await flow({
        selectedNetwork,
        manualSync: true,
        setupProviderOnInit: false,
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });
    } catch (error: unknown) {
      console.error(error);
    }
  };

  const login = async () => {
    try {
      // Triggering Login using Service Provider ==> opens the popup
      if (!coreKitInstance) {
        throw new Error("initiated to login");
      }
      const verifierConfig = {
        subVerifierDetails: {
          typeOfLogin: "google",
          verifier: "w3a-google-demo",
          clientId: "519228911939-cri01h55lsjbsia1k7ll6qpalrus75ps.apps.googleusercontent.com",
        },
      } as SubVerifierDetailsParams;

      await coreKitInstance.loginWithOauth(verifierConfig);
      setCoreKitStatus(coreKitInstance.status);
    } catch (error: unknown) {
      console.error(error);
    }
  };

  const getDeviceShare = async () => {
    const factorKey = await getWebBrowserFactor(coreKitInstance!);
    console.log('DeviceShare', factorKey);
    if (factorKey) {
      setDeviceFactorKey(factorKey);
      setBackupFactorKey(factorKey);
      uiConsole("Device share: ", factorKey);
    }
  };

  const inputBackupFactorKey = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    if (!backupFactorKey) {
      throw new Error("backupFactorKey not found");
    }

    const factorStr = mnemonicToKey(backupFactorKey)
    console.log("factorStr", factorStr);
    const factorKey = new BN(factorStr, "hex");
    console.log("factorKeyBN", factorKey);

    await coreKitInstance.inputFactorKey(factorKey);
    console.log("coreKitInstance.status", coreKitInstance.status);
    if (coreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) {
      uiConsole(
        "required more shares even after inputing backup factor key, please enter your backup/ device factor key, or reset account [unrecoverable once reset, please use it with caution]"
      );
    }

    setUpProvider();

    setCoreKitStatus(coreKitInstance.status);
    if (coreKitInstance.provider) {
      setProvider(coreKitInstance.provider);
    }
  };

  const recoverSecurityQuestionFactor = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    if (!answer) {
      throw new Error("backupFactorKey not found");
    }

    let factorKey = await securityQuestion.recoverFactor(coreKitInstance, answer);
    setBackupFactorKey(factorKey);
    uiConsole("Security Question share: ", factorKey);
  };

  const logout = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    await coreKitInstance.logout();
    uiConsole("Log out");
    setProvider(null);
    setCoreKitStatus(coreKitInstance.status);
  };

  const switchChain = async (namespace: CHAIN_NAMESPACE) => {
    if (!provider) {
      uiConsole("provider not initialized yet");
      return;
    }
    const newChainConfig = CHAIN_CONFIGS[namespace];
    await coreKitInstance.switchChain(newChainConfig);
    setProvider(coreKitInstance.provider);
    uiConsole(`Changed to ${namespace} Network`);
  };

  const criticalResetAccount = async (): Promise<void> => {
    // This is a critical function that should only be used for testing purposes
    // Resetting your account means clearing all the metadata associated with it from the metadata server
    // The key details will be deleted from our server and you will not be able to recover your account
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    //@ts-ignore
    // if (selectedNetwork === WEB3AUTH_NETWORK.MAINNET) {
    //   throw new Error("reset account is not recommended on mainnet");
    // }
    await coreKitInstance.tKey.storageLayer.setMetadata({
      privKey: new BN(coreKitInstance.metadataKey!, "hex"),
      input: { message: "KEY_NOT_FOUND" },
    });
    uiConsole("reset");
    setProvider(null);
  };

  const exportTssKey = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    const key = await coreKitInstance._UNSAFE_exportTssKey();
    console.log('key', key);
    let web3Local = new Web3();

    let account = web3Local.eth.accounts.privateKeyToAccount(`0x${key}`);
    console.log('account', account);
    // let signedTx = await account.signTransaction({ to: "0x2E464670992574A613f10F7682D5057fB507Cc21", value: "1000000000000000000" });
    // console.log('signedTx', signedTx);
    return key;
  };

  const importTssKey = async (newOauthLogin: string, importedTssKey: string) => {
    // import key to new instance
    let { idToken, parsedToken } = await mockLogin(newOauthLogin);

    const newCoreKitInstance = new Web3AuthMPCCoreKit({
      web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
      web3AuthNetwork: selectedNetwork,
      uxMode: "redirect",
      manualSync: true,
      setupProviderOnInit: false,
    });
    await newCoreKitInstance.init({ handleRedirectResult: false, rehydrate: false });
    uiConsole("TSS Private Key: ", importedTssKey);

    await newCoreKitInstance.loginWithJWT({
      verifier: "torus-test-health",
      verifierId: parsedToken.email,
      idToken: idToken,
      importTssKey: importedTssKey,
    });
    uiConsole(JSON.stringify({
      tssPriKey: importedTssKey,
      coreKitStatus: newCoreKitInstance.status,
    }));
    coreKitInstance = newCoreKitInstance;
    setCoreKitStatus(newCoreKitInstance.status);
  };

  const recoverTssKey = async (factorKeys: string[], newOauthLogin: string) => {
    const recoverMpcInstance = new Web3AuthMPCCoreKit({
      web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
      web3AuthNetwork: selectedNetwork,
      uxMode: "redirect",
      manualSync: true,
      setupProviderOnInit: false,
      // sessionTime: 3600, // <== can provide variable session time based on user subscribed plan
    });
    await recoverMpcInstance.init({ handleRedirectResult: false, rehydrate: false });

    let recoveredTssKey = await recoverMpcInstance._UNSAFE_recoverTssKey(factorKeys);
    uiConsole("Recovered TSS Private Key: ", recoveredTssKey);
    // let web3Local = new Web3();
    // let account = web3Local.eth.accounts.privateKeyToAccount(recoveredTssKey);
    // let signedTx = await account.signTransaction({ to: "0x2E464670992574A613f10F7682D5057fB507Cc21", value: "1000000000000000000" });
    // console.log(signedTx);
    return recoveredTssKey;
  };

  const exportTssKeyImportTssKey = async (newOauthLogin?: string) => {
    console.log('exportTssKeyImportTssKeyFunc', newOauthLogin);
    let key = await exportTssKey();
    console.log('key', key);
    await logout();
    // wait for 2 sec before import and login
    await new Promise(r => setTimeout(r, 2000));
    await importTssKey(newOauthLogin || mockEmail, key);
  };

  const recoverTssKeyImportTssKey = async () => {
    const factorKeys = [mnemonicToKey(deviceFactorKey), mnemonicToKey(recoveryFactor)];
    let key = await recoverTssKey(factorKeys, mockEmail);
    await importTssKey(mockEmail, key);
  };

  const unloggedInView = (
    <>
      <label>Mock Email:</label>
      <input value={mockEmail} onChange={(e) => setMockEmail(e.target.value)} />
      <button onClick={() => loginWithMock()} className="card">
        MockLogin
      </button>

      <button onClick={() => login()} className="card">
        Login
      </button>
      <div className={coreKitStatus === COREKIT_STATUS.REQUIRED_SHARE ? "" : "hidden"}>
        <button onClick={() => getDeviceShare()} className="card">
          Get Device Share
        </button>
        <label>Backup/ Device factor key:</label>
        <input value={backupFactorKey} onChange={(e) => setBackupFactorKey(e.target.value)}></input>
        <button onClick={() => inputBackupFactorKey()} className="card">
          Input Factor Key
        </button>
        <button onClick={criticalResetAccount} className="card">
          [CRITICAL] Reset Account
        </button>
        <div className={!question ? "disabledDiv" : ""}>
          <label>Recover Using Security Answer:</label>
          <label>{question}</label>
          <input value={answer} onChange={(e) => setAnswer(e.target.value)}></input>
          <button onClick={() => recoverSecurityQuestionFactor()} className="card">
            Recover Using Security Answer
          </button>
        </div>
      </div>
      <button onClick={() => timedFlow()} className="card">
        Timed Flow
      </button>
      <hr style={{ width: '100%' }} />
      <div className="recover-account-div">
        <h4>Recover account with factors</h4>
        <div className="recovery-form">
          <div className="left">
            <label>Device Factor: </label>
            <input value={deviceFactorKey} onChange={(e) => setDeviceFactorKey(e.target.value)} />
          </div>
          <div className="right">
            <label>Recovery Factor: </label>
            <input value={recoveryFactor} onChange={(e) => setRecoveryFactor(e.target.value)} />
          </div>
        </div>
        <button onClick={() => recoverTssKeyImportTssKey()} className="card">
          Recover Account with Factor Keys
        </button>
      </div>
    </>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a target="_blank" href="https://web3auth.io/docs/guides/mpc" rel="noreferrer">
          Web3Auth MPC Core Kit
        </a>{" "}
        Redirect Flow Example
      </h1>

      <div className="grid">
        {coreKitStatus === COREKIT_STATUS.LOGGED_IN ? (
          <LoggedinView
            coreKitInstance={coreKitInstance}
            web3={web3}
            criticalResetAccount={criticalResetAccount}
            logout={logout}
            inputBackupFactorKey={inputBackupFactorKey}
            switchChain={switchChain}
            exportImportTssKey={exportTssKeyImportTssKey}
          />
        ) : (
          unloggedInView
        )}
      </div>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>

      <footer className="footer">
        <a
          href="https://github.com/Web3Auth/web3auth-core-kit-examples/tree/main/tkey/tkey-mpc-beta-react-popup-example"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source code
        </a>
      </footer>
    </div>
  );
}

export default App;
