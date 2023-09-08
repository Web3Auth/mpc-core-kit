import { useEffect, useState } from "react";
import { Web3AuthMPCCoreKit, WEB3AUTH_NETWORK, Point, SubVerifierDetailsParams, TssFactorIndexType, storeWebBrowserFactor, getWebBrowserFactor } from "@web3auth/mpc-core-kit";
import Web3 from "web3";
import type { provider } from "web3-core";

import "./App.css";
import { SafeEventEmitterProvider } from "@web3auth/base";
import { BN } from "bn.js";

const uiConsole = (...args: any[]): void => {
  const el = document.querySelector("#console>p");
  if (el) {
    el.innerHTML = JSON.stringify(args || {}, null, 2);
  }
  console.log(...args);
};

function App() {
  const [backupFactorKey, setBackupFactorKey] = useState<string | undefined>(undefined);
  const [coreKitInstance, setCoreKitInstance] = useState<Web3AuthMPCCoreKit | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const [web3, setWeb3] = useState<any>(undefined)
  const [exportTssFactorIndexType, setExportTssFactorIndexType] = useState<TssFactorIndexType>(TssFactorIndexType.DEVICE);
  const [factorPubToDelete, setFactorPubToDelete] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      const coreKitInstance = new Web3AuthMPCCoreKit(
        {
          web3AuthClientId: 'BIr98s8ywUbjEGWq6jnq03UCYdD0YoUFzSyBFC0j1zIpve3cBUbjrkI8TpjFcExAvHaD_7vaOzzXyxhBfpliHsM',
          web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
          uxMode: 'popup'
        }
      );
      setCoreKitInstance(coreKitInstance);

      if (coreKitInstance.isResumable()) {
        const provider = await coreKitInstance.resumeSession();
        completeSetup(coreKitInstance, provider);
        return;
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
    const pubsHex = factorPubs[coreKitInstance.tKey.tssTag].map(pub => {
      return Point.fromTkeyPoint(pub).toBufferSEC1(true).toString('hex');
    });
    uiConsole(pubsHex);
  };

  const login = async () => {
    try {
      if (!coreKitInstance) {
        throw new Error('initiated to login');
      }
      const verifierConfig = {
        subVerifierDetails: { 
          typeOfLogin: 'google',
          verifier: 'google-tkey-w3a',
          clientId:
            '774338308167-q463s7kpvja16l4l0kko3nb925ikds2p.apps.googleusercontent.com',
        }
      } as SubVerifierDetailsParams;

      await coreKitInstance.loginWithOauth(verifierConfig);

      if (coreKitInstance.getKeyDetails().requiredShares > 0) {
        uiConsole("required more shares, please enter your backup/ device factor key, or reset account");
      } else {
        const provider = await coreKitInstance.getProvider();
        completeSetup(coreKitInstance, provider);
      }
    } catch (error: unknown) {
      uiConsole(error);
    }
  }

  const completeSetup = (coreKitInstance: Web3AuthMPCCoreKit, provider: SafeEventEmitterProvider) => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }

    setProvider(provider);
    const factorKey = coreKitInstance.generateFactorKey();
    coreKitInstance.createFactor(factorKey.private, TssFactorIndexType.DEVICE)
    storeWebBrowserFactor(factorKey.private, coreKitInstance)
  }

  const getDeviceShare = async () => {
    const factorKey = await getWebBrowserFactor(coreKitInstance!);
    setBackupFactorKey(factorKey.toString("hex"));
    uiConsole("Device share: ", factorKey.toString("hex"));
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

    if (coreKitInstance.getKeyDetails().requiredShares > 0) {
      uiConsole("required more shares even after inputing backup factor key, please enter your backup/ device factor key, or reset account");
    } else {
      const provider = await coreKitInstance.getProvider();
      completeSetup(coreKitInstance, provider);
    }
  }

  const logout = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    await coreKitInstance.logout();
    uiConsole("Log out");
    setProvider(undefined);
  };

  const getUserInfo = (): void => {
    const user = coreKitInstance?.getUserInfo();
    uiConsole(user);
  };

  const exportShare = async (): Promise<void> => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    uiConsole("export share type: ", exportTssFactorIndexType);
    const factorKey = coreKitInstance.generateFactorKey();
    await coreKitInstance.createFactor(factorKey.private, exportTssFactorIndexType);
    uiConsole("Export factor key: ", factorKey);
  }

  const deleteFactor = async (): Promise<void> => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    const pubBuffer = Buffer.from(factorPubToDelete, 'hex');
    const pub = Point.fromBufferSEC1(pubBuffer);
    await coreKitInstance.deleteFactor(pub.toTkeyPoint());
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
  };

  const resetAccount = async (): Promise<void> => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await coreKitInstance.CRITICAL_resetAccount();
    uiConsole('reset');
    setProvider(undefined);
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

  const loggedInView = (
    <>
      <h2 className="subtitle">Account Details</h2>
      <div className="flex-container">
        <button onClick={getUserInfo} className="card">
          Get User Info
        </button>

        <button onClick={keyDetails} className="card">
          Key Details
        </button>

        <button onClick={listFactors} className="card">
          List Factors
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

        <label>Share Type:</label>
        <select value={exportTssFactorIndexType}onChange={(e) => setExportTssFactorIndexType(parseInt(e.target.value))}>
          <option value={TssFactorIndexType.DEVICE}>Device Share</option>
          <option value={TssFactorIndexType.RECOVERY}>Recovery Share</option>
        </select>
        <button onClick={exportShare} className="card">
          Export share
        </button>
        <label>Factor pub:</label>
        <input value={factorPubToDelete} onChange={(e) => setFactorPubToDelete(e.target.value)}></input>
        <button onClick={deleteFactor} className="card">
          Delete Factor
        </button>
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
    </>
  );

  const unloggedInView = (
    <>
      <button onClick={() => login()} className="card">
        Login
      </button>
      <button onClick={() => getDeviceShare()} className="card">
        Get Device Share
      </button>
      <label>Backup/ Device factor key:</label>
      <input value={backupFactorKey} onChange={(e) => setBackupFactorKey(e.target.value)}></input>
      <button onClick={() => inputBackupFactorKey()} className="card">
        Input Factor Key
      </button>
      <button onClick={resetAccount} className="card">
        Reset Account
      </button>
    </>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a target="_blank" href="https://web3auth.io/docs/guides/mpc" rel="noreferrer">
          Web3Auth MPC Core Kit 
        </a> {" "}
        Popup Flow & ReactJS Example
      </h1>

      <div className="grid">{provider ? loggedInView : unloggedInView}</div>
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
