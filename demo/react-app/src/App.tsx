/* eslint-disable no-throw-literal */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable require-atomic-updates */
/* eslint-disable @typescript-eslint/no-shadow */
import { useEffect, useState } from "react";
import { Web3AuthMPCCoreKit, WEB3AUTH_NETWORK } from "@web3auth/mpc-core-kit";
import Web3 from 'web3';
import type { provider } from "web3-core";
// import swal from "sweetalert";

import "./App.css";
import { generateIdToken } from "./utils";
import { SafeEventEmitterProvider } from "@web3auth/base";
import { SubVerifierDetails } from "@toruslabs/customauth";
import { BN } from "bn.js";

const uiConsole = (...args: any[]): void => {
  const el = document.querySelector("#console>p");
  if (el) {
    el.innerHTML = JSON.stringify(args || {}, null, 2);
  }
  console.log(...args);
};


function App() {
  const [loginFactorKey, setLoginFactorKey] = useState<string | undefined>(undefined);
  const [loginResponse, setLoginResponse] = useState<any>(undefined);
  const [coreKitInstance, setCoreKitInstance] = useState<Web3AuthMPCCoreKit | undefined>(undefined);
  const [provider, setProvider] = useState<SafeEventEmitterProvider | undefined>(undefined);
  const [web3, setWeb3] = useState<any>(undefined)
  const [mockVerifierId, setMockVerifierId] = useState<string | undefined>(undefined);
  const [showBackupPhraseScreen, setShowBackupPhraseScreen] = useState<boolean>(false);
  const [seedPhrase, setSeedPhrase] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [exportShareIndex, setExportShareIndex] = useState<number>(2);

  useEffect(() => {
    if (!mockVerifierId) return;
    localStorage.setItem(`mockVerifierId`, mockVerifierId);
  }, [mockVerifierId]);

  useEffect(() => {
    let verifierId: string;

    const localMockVerifierId = localStorage.getItem("mockVerifierId");
    if (localMockVerifierId) verifierId = localMockVerifierId;
    else verifierId = Math.round(Math.random() * 100000) + "@example.com";
    setMockVerifierId(verifierId);

  }, []);

  useEffect(() => {
    const init = async () => {
      const coreKitInstance = new Web3AuthMPCCoreKit({ web3AuthClientId: 'torus-key-test', web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET, uxMode: 'popup'  })
      setCoreKitInstance(coreKitInstance);
      if (coreKitInstance.provider) setProvider(coreKitInstance.provider);
      if (window.location.hash.includes('#state')) {
        try {
          const factorKey = loginFactorKey ? new BN(loginFactorKey, "hex") : undefined;
          const provider = await coreKitInstance.handleRedirectResult(factorKey);
          if (provider) {
            setProvider(provider)
            const keyDetails = coreKitInstance.getKeyDetails();
            setExportShareIndex(keyDetails.tssIndex)
          }
        } catch (error) {
          if ((error as Error).message === "required more shares") {
            setShowBackupPhraseScreen(true);
          }
        }
      }
    }
    init()
  }, [])

  useEffect(() => {
    if(provider) {
      const web3 = new Web3(provider as provider);
      setWeb3(web3);
    }
  }, [provider])

  const keyDetails = async () => {
    if (!coreKitInstance) {
      throw new Error('coreKitInstance not found');
    }
    uiConsole(coreKitInstance.getKeyDetails())
  };

  const login = async (mockLogin: boolean) => {
    try {
      if (!coreKitInstance) {
        throw new Error('initiated to login');
      }
      if (!mockVerifierId) {
        throw new Error('mockVerifierId not found');
      }
      const token = generateIdToken(mockVerifierId, "ES256");
      const verifierConfig = mockLogin ? {
        verifier: "torus-test-health",
        typeOfLogin: 'jwt',
        clientId: "torus-key-test",
        jwtParams: {
          verifierIdField: "email",
          id_token: token
        }
      } as SubVerifierDetails : {
        typeOfLogin: 'google',
        verifier: 'google-tkey-w3a',
        clientId:
            '774338308167-q463s7kpvja16l4l0kko3nb925ikds2p.apps.googleusercontent.com',
      } as SubVerifierDetails;
  
      const factorKey = loginFactorKey ? new BN(loginFactorKey, "hex") : undefined;
      const provider = await coreKitInstance.login({ subVerifierDetails: verifierConfig }, factorKey);
      
      if (provider) {
        setProvider(provider)
        const keyDetails = coreKitInstance.getKeyDetails();
        setExportShareIndex(keyDetails.tssIndex)
      }
    } catch (error: unknown) {
      console.log(error);
      if ((error as Error).message === "required more shares") {
        setShowBackupPhraseScreen(true);
      }
    }
  }

  const logout = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    await coreKitInstance.logout();
    uiConsole("Log out");
    setProvider(undefined);
    setLoginResponse(undefined);
  };

  const getUserInfo = (): void => {
    const user = coreKitInstance?.getUserInfo();
    uiConsole(user);
  };

  const getLoginResponse = (): void => {
    uiConsole(loginResponse);
  };

  const exportShare = async (): Promise<void> => { 
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    const factorKey = coreKitInstance.generateFactorKey();
    // 91085@example.com
    // 9d2615f7c497776baddee6a6d0f0c05c6b0f2f83444c01d5f788195925131cac
    // f5ee378240e45188ce328c028a0de73d8232142170f0fb30494647b61cbead46
    await coreKitInstance.createFactor(factorKey, exportShareIndex);
    console.log("Export factor key: ", factorKey);
    uiConsole("Export factor key: ", factorKey);
  }

  const submitBackupShare = async (): Promise<void> => { 
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    // await coreKitInstance.inputBackupShare(seedPhrase);
    // uiConsole('submitted');
    // if (coreKitInstance.provider) setProvider(coreKitInstance.provider);
    throw new Error('not implemented');
  }

  const savePasswordShare = async () => {
    try {
      if (!coreKitInstance) { 
        throw new Error("coreKitInstance is not set");
      }
      // await coreKitInstance.addSecurityQuestionShare("What is your password?", password);
      // uiConsole('saved');
      throw new Error('not implemented');
    } catch (err) {
      uiConsole(err);
    }
  }

  const updatePasswordShare = async () => {
    try {
      if (!coreKitInstance) { 
        throw new Error("coreKitInstance is not set");
      }
      // await coreKitInstance.changeSecurityQuestionShare("What is your password?", password);
      // uiConsole('updated');
      throw new Error('not implemented');
    } catch (err) {
      uiConsole(err);
    }
  }

  const deletePasswordShare = async () => {
    try {
      if (!coreKitInstance) { 
        throw new Error("coreKitInstance is not set");
      }
      // await coreKitInstance.deleteSecurityQuestionShare("What is your password?");
      // uiConsole('deleted');
      throw new Error('not implemented');
    } catch (err) {
      uiConsole(err);
    }
  }

  const recoverViaPassword = async () => {
    if (!coreKitInstance) { 
      throw new Error("coreKitInstance is not set");
    }
    // await coreKitInstance.recoverSecurityQuestionShare("What is your password?", password);
    // uiConsole('submitted');
    // if (coreKitInstance.provider) setProvider(coreKitInstance.provider);
    throw new Error('not implemented');
  }
  
  const getChainID = async () => {
    if (!web3) {
      console.log("web3 not initialized yet");
      return;
    }
    const chainId = await web3.eth.getChainId();
    uiConsole(chainId);
    return chainId;
  };

  const getAccounts = async () => {
    if (!web3) {
      console.log("web3 not initialized yet");
      return;
    }
    const address = (await web3.eth.getAccounts())[0];
    uiConsole(address);
    return address;
  };

  const getBalance = async () => {
    if (!web3) {
      console.log("web3 not initialized yet");
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
    if (!web3) {
      console.log("web3 not initialized yet");
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
  };

  const resetAccount = async (): Promise<void> => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await coreKitInstance.CRITICAL_resetAccount();
    uiConsole('reset');
    setLoginResponse(undefined);
    setProvider(undefined);
    setShowBackupPhraseScreen(false);
  }

  const sendTransaction = async () => {
    if (!web3) {
      console.log("web3 not initialized yet");
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

  const loggedInView = (
    <>
      <h2 className="subtitle">Account Details</h2>
      <div className="flex-container">

        <button onClick={getUserInfo} className="card">
          Get User Info
        </button>


        <button onClick={getLoginResponse} className="card">
          See Login Response
        </button>


        <button onClick={keyDetails} className="card">
          Key Details
        </button>


        <button onClick={resetAccount} className="card">
          Reset Account
        </button>


        <button onClick={logout} className="card">
          Log Out
        </button>

      </div>
      <h2 className="subtitle">Recovery/ Key Manipulation</h2>
      <div className="flex-container">

        <label>Share index:</label>
        <input value={exportShareIndex} onChange={(e) => setExportShareIndex(parseInt(e.target.value))}></input>
        <button onClick={exportShare} className="card">
          Export share
        </button>

        {/* <input value={password} onChange={(e) => setPassword(e.target.value)}></input>
        <button onClick={savePasswordShare} className="card">
          Save Password Share
        </button>

        <input value={password} onChange={(e) => setPassword(e.target.value)}></input>
        <button onClick={updatePasswordShare} className="card">
          Update Password Share
        </button>

        <button onClick={deletePasswordShare} className="card">
          Delete Password Share
        </button> */}

      </div>
      <h2 className="subtitle">Blockchain Calls</h2>
      <div className="flex-container">

        <button onClick={getChainID} className="card">
          Get Chain ID
        </button>


        <button onClick={getAccounts} className="card">
          Get Accounts
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

      </div>

      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>
    </>
  );

  const unloggedInView = (
    <>
    {
      !showBackupPhraseScreen && (
        <>
          <label>Login factor key (optional):</label>
          <input value={loginFactorKey} onChange={(e) => setLoginFactorKey(e.target.value)}></input>
          <button onClick={() => login(false)} className="card">
            Login
          </button>
          <button onClick={() => login(true)} className="card">
            MockLogin
          </button>
        </>
      )
    }

      <p>Mock Login Seed Email</p>
      <input value={mockVerifierId} onChange={(e) => setMockVerifierId(e.target.value)}></input>

      {
        showBackupPhraseScreen && ( 
          <>
            <textarea value={seedPhrase} onChange={(e) => setSeedPhrase(e.target.value)}></textarea>
            <button onClick={submitBackupShare} className="card">
              Submit backup share
            </button>
            <hr />
            OR
            <hr/>
            <input value={password} onChange={(e) => setPassword(e.target.value)}></input>
            <button onClick={recoverViaPassword} className="card">
              Recover using password Share
            </button>

            <button onClick={resetAccount} className="card">
              Reset Account
            </button>
            <div id="console" style={{ whiteSpace: "pre-line" }}>
              <p style={{ whiteSpace: "pre-line" }}></p>
            </div>
          </>
        )
      }
    </>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a target="_blank" href="https://web3auth.io/docs/guides/mpc" rel="noreferrer">
          Web3Auth Core Kit tKey MPC Beta
        </a> {" "}
        & ReactJS Ethereum Example
      </h1>

      <div className="grid">{provider ? loggedInView : unloggedInView}</div>

      <footer className="footer">
        <a href="https://github.com/Web3Auth/web3auth-core-kit-examples/tree/main/tkey/tkey-mpc-beta-react-popup-example" target="_blank" rel="noopener noreferrer">
          Source code
        </a>
      </footer>
    </div>
  );
}

export default App;
