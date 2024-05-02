import { useEffect, useState } from "react";
import { Web3AuthMPCCoreKit, WEB3AUTH_NETWORK, Point, SubVerifierDetailsParams, TssShareType, keyToMnemonic, getWebBrowserFactor, COREKIT_STATUS, TssSecurityQuestion, generateFactorKey, mnemonicToKey, parseToken, DEFAULT_CHAIN_CONFIG } from "@web3auth/mpc-core-kit";
import Web3 from "web3";
import type { provider } from "web3-core";

import "./App.css";
import { CHAIN_NAMESPACES, SafeEventEmitterProvider } from "@web3auth/base";
import { BN } from "bn.js";

import jwt, { Algorithm } from "jsonwebtoken";
import { flow } from "./flow";
import { KeyType } from "@tkey/common-types";
import { FACTOR_KEY_TYPE } from "@tkey/tss";
import { wasm } from "@toruslabs/tss-frost-client-wasm";


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

const coreKitInstance = new Web3AuthMPCCoreKit(
  {
    web3AuthClientId: 'BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ',
    web3AuthNetwork: selectedNetwork,
    uxMode: 'redirect',
    manualSync: true,
    setupProviderOnInit: false,
    tssKeyType: KeyType.ed25519,
    tssWasmURL: wasm,
  }
);

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

  const token = jwt.sign(payload, jwtPrivateKey, algo);
  const idToken = token;
  const parsedToken = parseToken(idToken);
  return { idToken, parsedToken };
};

function App() {
  const [mockEmail, setMockEmail] = useState<string | undefined>(undefined);

  const [backupFactorKey, setBackupFactorKey] = useState<string | undefined>(undefined);
  const [provider, setProvider] = useState<SafeEventEmitterProvider | null>(null);
  const [web3, setWeb3] = useState<any>(undefined)
  const [exportTssShareType, setExportTssShareType] = useState<TssShareType>(TssShareType.DEVICE);
  const [factorPubToDelete, setFactorPubToDelete] = useState<string>("");
  const [coreKitStatus, setCoreKitStatus] = useState<COREKIT_STATUS>(COREKIT_STATUS.NOT_INITIALIZED);
  const [answer, setAnswer] = useState<string | undefined>(undefined);
  const [newAnswer, setNewAnswer] = useState<string | undefined>(undefined);
  const [question, setQuestion] = useState<string | undefined>(undefined);
  const [newQuestion, setNewQuestion] = useState<string | undefined>(undefined);




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
        uiConsole("required more shares, please enter your backup/ device factor key, or reset account unrecoverable once reset, please use it with caution]");
      }

      console.log("coreKitInstance.status", coreKitInstance.status)
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
  }, [provider])


  const keyDetails = async () => {
    if (!coreKitInstance) {
      throw new Error('coreKitInstance not found');
    }
    uiConsole(coreKitInstance.getKeyDetails());
  };

  const listFactors = async () => {
    if (!coreKitInstance) {
      throw new Error('coreKitInstance not found');
    }
    const factorPubs = coreKitInstance.tKey.metadata.factorPubs;
    if (!factorPubs) {
      throw new Error('factorPubs not found');
    }
    const pubsHex = factorPubs[coreKitInstance.tKey.tssTag].map((pub: any) => {
      return Point.fromTkeyPoint(pub).toBufferSEC1(true).toString('hex');
    });
    uiConsole(pubsHex);
  };

  const loginWithMock = async () => {
    try {
      if (!mockEmail) {
        throw new Error('mockEmail not found');
      }
      const { idToken, parsedToken } = await mockLogin(mockEmail);
      await coreKitInstance.loginWithJWT({
        verifier: 'torus-test-health',
        verifierId: parsedToken.email,
        idToken,
      }, {prefetchTssPublicKeys: 1} );
      if (coreKitInstance.provider) {
        setProvider(coreKitInstance.provider);
      }
      else {
        coreKitInstance.setupProvider({ chainConfig: DEFAULT_CHAIN_CONFIG }).then(() => {
          
          setProvider(coreKitInstance.provider);
        });
      }
      setCoreKitStatus(coreKitInstance.status);
    } catch (error: unknown) {
      console.error(error);
    }
  }

  const timedFlow = async () => {
    try {
      if (!mockEmail) {
        throw new Error('mockEmail not found');
      }
      const { idToken, parsedToken } = await mockLogin(mockEmail);
      await flow({ selectedNetwork, manualSync: true, setupProviderOnInit: false,  verifier: 'torus-test-health', verifierId: parsedToken.email, idToken });
    }
    catch (error: unknown) {
      console.error(error);
    }
  }

  const login = async () => {
    try {
      // Triggering Login using Service Provider ==> opens the popup
      if (!coreKitInstance) {
        throw new Error('initiated to login');
      }
      const verifierConfig = {
        subVerifierDetails: {
          typeOfLogin: 'google',
          verifier: 'w3a-google-demo',
          clientId:
            '519228911939-cri01h55lsjbsia1k7ll6qpalrus75ps.apps.googleusercontent.com',
        }
      } as SubVerifierDetailsParams;

      await coreKitInstance.loginWithOauth(verifierConfig);
      setCoreKitStatus(coreKitInstance.status);

    } catch (error: unknown) {
      console.error(error);
    }
  };

  const getDeviceShare = async () => {
    const factorKey = await getWebBrowserFactor(coreKitInstance!);
    setBackupFactorKey(factorKey);
    uiConsole("Device share: ", factorKey);
  }

  const inputBackupFactorKey = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    if (!backupFactorKey) {
      throw new Error("backupFactorKey not found");
    }
    const factorKey = new BN(backupFactorKey, "hex")
    await coreKitInstance.inputFactorKey(factorKey);

    if (coreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) {
      uiConsole("required more shares even after inputing backup factor key, please enter your backup/ device factor key, or reset account [unrecoverable once reset, please use it with caution]");
    }

    if (coreKitInstance.provider) {
      setProvider(coreKitInstance.provider);
    }
  }

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
  }

  const logout = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    await coreKitInstance.logout();
    uiConsole("Log out");
    setProvider(null);
    setCoreKitStatus(coreKitInstance.status);
  };

  const getUserInfo = (): void => {
    const user = coreKitInstance?.getUserInfo();
    uiConsole(user);
  };

  const exportFactor = async (): Promise<void> => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    uiConsole("export share type: ", exportTssShareType);
    const factorKey = generateFactorKey();
    await coreKitInstance.createFactor({
      shareType: exportTssShareType,
      factorKey: factorKey.private
    });
    let mnemonic = keyToMnemonic(factorKey.private.toString('hex'));
    let key = mnemonicToKey(mnemonic);

    uiConsole("Export factor key: ", factorKey);
    console.log("menmonic : ", mnemonic);
    console.log("key: ", key);
  }

  const deleteFactor = async (): Promise<void> => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    const pubBuffer = Buffer.from(factorPubToDelete, 'hex');
    const pub = Point.fromBufferSEC1(pubBuffer);
    await coreKitInstance.deleteFactor(pub.toTkeyPoint(FACTOR_KEY_TYPE));
    uiConsole("factor deleted");
  }

  const getChainID = async () => {
    if (!web3) {
      uiConsole("web3 not initialized yet");
      return;
    }
    const chainId = await web3.eth.getChainId();
    uiConsole(chainId);
    return chainId;
  };

  const setTSSWalletIndex = async (index=0) => {
    await coreKitInstance.setTssWalletIndex(index);
    // log new account details 
    await getAccounts();
  }


  const getAccounts = async () => {
    if (!web3) {
      uiConsole("web3 not initialized yet");
      return;
    }
    const address = (await web3.eth.getAccounts())[0];
    uiConsole(address);
    return address;
  };

  const getBalance = async () => {
    if (!web3) {
      uiConsole("web3 not initialized yet");
      return;
    }
    const address = (await web3.eth.getAccounts())[0];
    const balance = web3.utils.fromWei(
      await web3.eth.getBalance(address) // Balance is in wei
    );
    uiConsole(balance);
    return balance;
  };

  const signMessage = async (): Promise<any> => {
    if (coreKitInstance.tssKeyType === 'secp256k1') {
      if (!web3) {
        uiConsole("web3 not initialized yet");
        return;
      }
      const fromAddress = (await web3.eth.getAccounts())[0];
      const originalMessage = [
        {
          type: "string",
          name: "fullName",
          value: "Satoshi Nakamoto",
        },
        {
          type: "uint32",
          name: "userId",
          value: "1212",
        },
      ];
      const params = [originalMessage, fromAddress];
      const method = "eth_signTypedData";
      const signedMessage = await (web3.currentProvider as any)?.sendAsync({
        id: 1,
        method,
        params,
        fromAddress,
      });

      uiConsole(signedMessage);
    } else if (coreKitInstance.tssKeyType === 'ed25519') {
      const msg = Buffer.from("0xaabb");
      const sig = await coreKitInstance.signMessage(msg);
      uiConsole(sig.toString("hex"));
    }
  };

  const switchChainSepolia = async () => {
    if (!provider) {
      uiConsole("provider not initialized yet");
      return;
    }
    const newChainConfig = {
      chainId: "0xaa36a7", // for wallet connect make sure to pass in this chain in the loginSettings of the adapter.
      displayName: "Ethereum Sepolia",
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      tickerName: "Ethereum Sepolia",
      ticker: "ETH",
      decimals: 18,
      rpcTarget: "https://rpc.ankr.com/eth_sepolia",
      blockExplorer: "https://sepolia.etherscan.io",
      logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
    };
    await coreKitInstance.switchChain(newChainConfig);
    setProvider(coreKitInstance.provider);
    uiConsole("Changed to Sepolia Network");
  };

  const switchChainPolygon = async () => {
    if (!provider) {
      uiConsole("provider not initialized yet");
      return;
    }
    const newChainConfig = {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: "0x89", // hex of 137, polygon mainnet
      rpcTarget: "https://rpc.ankr.com/polygon",
      // Avoid using public rpcTarget in production.
      // Use services like Infura, Quicknode etc
      displayName: "Polygon Mainnet",
      blockExplorer: "https://polygonscan.com",
      ticker: "MATIC",
      tickerName: "MATIC",
    };
    await coreKitInstance.switchChain(newChainConfig);
    setProvider(coreKitInstance.provider);
    uiConsole("Changed to Sepolia Network");
  };

  const switchChainOPBNB = async () => {
    if (!provider) {
      uiConsole("provider not initialized yet");
      return;
    }
    const newChainConfig = {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: "0xCC", // hex of 1261120
      rpcTarget: "https://opbnb-mainnet-rpc.bnbchain.org",
      // Avoid using public rpcTarget in production.
      // Use services like Infura, Quicknode etc
      displayName: "opBNB Mainnet",
      blockExplorer: "https://opbnbscan.com",
      ticker: "BNB",
      tickerName: "opBNB",
    };
    await coreKitInstance.switchChain(newChainConfig);
    setProvider(coreKitInstance.provider);
    uiConsole("Changed to Sepolia Network");
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
    uiConsole('reset');
    setProvider(null);
  }

  const sendTransaction = async () => {
    if (!web3) {
      uiConsole("web3 not initialized yet");
      return;
    }
    const fromAddress = (await web3.eth.getAccounts())[0];

    const destination = "0x2E464670992574A613f10F7682D5057fB507Cc21";
    const amount = web3.utils.toWei("0.0001"); // Convert 1 ether to wei

    // Submit transaction to the blockchain and wait for it to be mined
    uiConsole("Sending transaction...");
    const receipt = await web3.eth.sendTransaction({
      from: fromAddress,
      to: destination,
      value: amount,
    });
    uiConsole(receipt);
  };

  const createSecurityQuestion = async (question: string, answer: string) => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await securityQuestion.setSecurityQuestion({ mpcCoreKit: coreKitInstance, question, answer, shareType: TssShareType.RECOVERY });
    setNewQuestion(undefined);
    let result = await securityQuestion.getQuestion(coreKitInstance);
    if (result) {
      setQuestion(question);
    }
  }

  const changeSecurityQuestion = async (newQuestion: string, newAnswer: string, answer: string) => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await securityQuestion.changeSecurityQuestion({ mpcCoreKit: coreKitInstance, newQuestion, newAnswer, answer });
    let result = await securityQuestion.getQuestion(coreKitInstance);
    if (result) {
      setQuestion(question);
    }
  }

  const deleteSecurityQuestion = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await securityQuestion.deleteSecurityQuestion(coreKitInstance);
    setQuestion(undefined);

  }

  const enableMFA = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    const factorKey = await coreKitInstance.enableMFA({});
    const factorKeyMnemonic = await keyToMnemonic(factorKey);

    uiConsole("MFA enabled, device factor stored in local store, deleted hashed cloud key, your backup factor key: ", factorKeyMnemonic);
  }

  const commit = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await coreKitInstance.commitChanges();
  }

  const loggedInView = (
    <>
      <h2 className="subtitle">Account Details</h2>
      <div className="flex-container">
        <button onClick={getUserInfo} className="card">
          Get User Info
        </button>

        <button onClick={async () => uiConsole(await coreKitInstance.getTssPublicKey())} className="card">
          Get Public Key
        </button>

        <button onClick={keyDetails} className="card">
          Key Details
        </button>

        <button onClick={listFactors} className="card">
          List Factors
        </button>

        <button onClick={commit} className="card">
          Commit Changes
        </button>
      </div>
      <div className="flex-container">

        <button onClick={criticalResetAccount} className="card">
          [CRITICAL] Reset Account
        </button>

        <button onClick={async () => uiConsole(await coreKitInstance._UNSAFE_exportTssKey())} className="card">
          [CAUTION] Export TSS Private Key
        </button>

        <button onClick={logout} className="card">
          Log Out
        </button>

      </div>
      <h2 className="subtitle">Recovery/ Key Manipulation</h2>
      <div>
        <h4 >Enabling MFA</h4>
        <div className="flex-container">
          <button onClick={enableMFA} className="card">
            Enable MFA
          </button>
        </div>
        <h4 >Manual Factors Manipulation</h4>
        <div className="flex-container">

          <label>Share Type:</label>
          <select value={exportTssShareType} onChange={(e) => setExportTssShareType(parseInt(e.target.value))}>
            <option value={TssShareType.DEVICE}>Device Share</option>
            <option value={TssShareType.RECOVERY}>Recovery Share</option>
          </select>
          <button onClick={exportFactor} className="card">
            Export share
          </button>
        </div>
        <div className="flex-container">
          <label>Factor pub:</label>
          <input value={factorPubToDelete} onChange={(e) => setFactorPubToDelete(e.target.value)}></input>
          <button onClick={deleteFactor} className="card">
            Delete Factor
          </button>
        </div>
        <div className="flex-container">
          <input value={backupFactorKey} onChange={(e) => setBackupFactorKey(e.target.value)}></input>
          <button onClick={() => inputBackupFactorKey()} className="card">
            Input Factor Key
          </button>
        </div>


        <h4>Security Question</h4>

        <div>{question}</div>
        <div className="flex-container">
          <div className={question ? " disabledDiv" : ""}>
            <label>Set Security Question:</label>
            <input value={question} placeholder="question" onChange={(e) => setNewQuestion(e.target.value)}></input>
            <input value={answer} placeholder="answer" onChange={(e) => setAnswer(e.target.value)}></input>
            <button onClick={() => createSecurityQuestion(newQuestion!, answer!)} className="card">
              Create Security Question
            </button>
          </div>

          <div className={!question ? " disabledDiv" : ""}>
            <label>Change Security Question:</label>
            <input value={newQuestion} placeholder="newQuestion" onChange={(e) => setNewQuestion(e.target.value)}></input>
            <input value={newAnswer} placeholder="newAnswer" onChange={(e) => setNewAnswer(e.target.value)}></input>
            <input value={answer} placeholder="oldAnswer" onChange={(e) => setAnswer(e.target.value)}></input>
            <button onClick={() => changeSecurityQuestion(newQuestion!, newAnswer!, answer!)} className="card">
              Change Security Question
            </button>

          </div>
        </div>
        <div className="flex-container">
          <div className={!question ? "disabledDiv" : ""}>
            <button onClick={() => deleteSecurityQuestion()} className="card">
              Delete Security Question
            </button>
          </div>
        </div>
      </div>
      <h2 className="subtitle">Blockchain Calls</h2>
      <div className="flex-container">

        <button onClick={getChainID} className="card">
          Get Chain ID
        </button>

        <button onClick={getAccounts} className="card">
          Get Accounts
        </button>

        <button onClick={() => setTSSWalletIndex(1)} className="card">
          Switch to wallet index: 1
        </button>
        <button onClick={() => setTSSWalletIndex(2)} className="card">
          Switch to wallet index: 2
        </button>
        <button onClick={() => setTSSWalletIndex(0)} className="card">
          Switch to wallet index: 0/default
        </button>

        <button onClick={getBalance} className="card">
          Get Balance
        </button>

        <button onClick={signMessage} className="card">
          Sign Message
        </button>

        <button onClick={sendTransaction} className="card">
          Send Transaction
        </button>

        <button onClick={switchChainSepolia} className="card">
          switchChainSepolia
        </button>

        <button onClick={switchChainPolygon} className="card">
          switchChainPolygon
        </button>

        <button onClick={switchChainOPBNB} className="card">
          switchChainOPBNB
        </button>
      </div>
    </>
  );

  const unloggedInView = (
    <>
      <input value={mockEmail} onChange={(e) => setMockEmail(e.target.value)}></input>
      <button onClick={() => loginWithMock()} className="card">
        MockLogin
      </button>

      <button onClick={() => login()} className="card">
        Login
      </button>
      <div className={coreKitStatus === COREKIT_STATUS.REQUIRED_SHARE ? "" : "disabledDiv"} >

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

    </>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a target="_blank" href="https://web3auth.io/docs/guides/mpc" rel="noreferrer">
          Web3Auth MPC Core Kit
        </a> {" "}
        Redirect Flow Example
      </h1>

      <div className="grid">{coreKitStatus === COREKIT_STATUS.LOGGED_IN ? loggedInView : unloggedInView}</div>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>

      <footer className="footer">
        <a href="https://github.com/Web3Auth/web3auth-core-kit-examples/tree/main/tkey/tkey-mpc-beta-react-popup-example" target="_blank" rel="noopener noreferrer">
          Source code
        </a>
      </footer>
    </div>
  );
}

export default App;
