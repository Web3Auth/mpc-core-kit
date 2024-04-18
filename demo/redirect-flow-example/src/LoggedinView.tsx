import { Web3AuthMPCCoreKit, Point, keyToMnemonic, TssShareType, generateFactorKey, mnemonicToKey } from "@web3auth/mpc-core-kit";
import { useState } from "react";
import SecurityQuestion from "./components/SecurityQuestion";
import BlockchainCalls from "./components/BlockchainCalls";
import { CHAIN_NAMESPACE } from "./utils";
import Web3 from "web3";

interface ILoggedinViewProps {
  web3: Web3;
  coreKitInstance: Web3AuthMPCCoreKit;
  criticalResetAccount: () => void;
  logout: () => void;
  switchChain: (namespace: CHAIN_NAMESPACE) => void;
  inputBackupFactorKey: () => void;
  exportImportTssKey: () => void;
}

function uiConsole(...args: any[]): void {
  const el = document.querySelector("#console>p");
  if (el) {
    el.innerHTML = JSON.stringify(args || {}, null, 2);
  }
  console.log(...args);
}

function LoggedinView({ web3, coreKitInstance, criticalResetAccount, logout, inputBackupFactorKey, switchChain, exportImportTssKey }: ILoggedinViewProps) {
  const [exportTssShareType, setExportTssShareType] = useState<TssShareType>(TssShareType.DEVICE);
  const [factorPubToDelete, setFactorPubToDelete] = useState<string>("");
  const [backupFactorKey, setBackupFactorKey] = useState<string | undefined>(undefined);

  const getUserInfo = async () => {
    const userInfo = coreKitInstance.getUserInfo();
    uiConsole(userInfo);
  };

  const keyDetails = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    uiConsole(coreKitInstance.getKeyDetails());
  };

  const listFactors = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    const factorPubs = coreKitInstance.tKey.metadata.factorPubs;
    if (!factorPubs) {
      throw new Error("factorPubs not found");
    }
    const pubsHex = factorPubs[coreKitInstance.tKey.tssTag].map((pub: any) => {
      return Point.fromTkeyPoint(pub).toBufferSEC1(true).toString("hex");
    });
    uiConsole(pubsHex);
  };

  const commit = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await coreKitInstance.commitChanges();
  };

  const enableMFA = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    const factorKey = await coreKitInstance.enableMFA({});
    const factorKeyMnemonic = keyToMnemonic(factorKey);

    uiConsole("MFA enabled, device factor stored in local store, deleted hashed cloud key, your backup factor key: ", factorKeyMnemonic);
  };

  const exportFactor = async (): Promise<void> => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    uiConsole("export share type: ", exportTssShareType);
    const factorKey = generateFactorKey();
    await coreKitInstance.createFactor({
      shareType: exportTssShareType,
      factorKey: factorKey.private,
    });
    let mnemonic = keyToMnemonic(factorKey.private.toString("hex"));
    let key = mnemonicToKey(mnemonic);

    uiConsole("Export factor key: ", factorKey);
    console.log("menmonic : ", mnemonic);
    console.log("key: ", key);
  };

  const deleteFactor = async (): Promise<void> => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    const pubBuffer = Buffer.from(factorPubToDelete, "hex");
    const pub = Point.fromBufferSEC1(pubBuffer);
    await coreKitInstance.deleteFactor(pub.toTkeyPoint());
    uiConsole("factor deleted");
  };

  const unsafeExportTssKey = async () => {
    const exportedTssKey = await coreKitInstance._UNSAFE_exportTssKey();
    let web3Local = new Web3("https://eth.llamarpc.com");

    let account = web3Local.eth.accounts.privateKeyToAccount(`0x${exportedTssKey}`);
    console.log('account', account);
    let gas = await web3Local.eth.estimateGas({ to: "0x2E464670992574A613f10F7682D5057fB507Cc21", value: "1000000000000000000" })
    let signedTx = await account.signTransaction({ to: "0x2E464670992574A613f10F7682D5057fB507Cc21", value: "1000000000000000000", gas: gas});
    console.log('signedTx', signedTx);
    uiConsole(exportedTssKey);
  }

  const exportAndImportTssKey = () => {
    console.log('exportAndImportTssKey', exportAndImportTssKey);
    exportImportTssKey();
  }

  return (
    <div>
      <h2 className="subtitle">Account Details</h2>
      <div className="flex-container">
        <button onClick={getUserInfo} className="card">
          Get User Info
        </button>

        <button onClick={async () => uiConsole(coreKitInstance.getTssPublicKey())} className="card">
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

        <button onClick={unsafeExportTssKey} className="card">
          [CAUTION] Export TSS Private Key
        </button>

        <button onClick={exportAndImportTssKey} className="card">
          Export/Import TSS Key
        </button>

        <button onClick={logout} className="card">
          Log Out
        </button>
      </div>
      <h2 className="subtitle">Recovery/ Key Manipulation</h2>
      <div>
        <h4>Enabling MFA</h4>
        <div className="flex-container">
          <button onClick={enableMFA} className="card">
            Enable MFA
          </button>
        </div>
        <h4>Manual Factors Manipulation</h4>
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

        <SecurityQuestion coreKitInstance={coreKitInstance} />
      </div>

      <BlockchainCalls coreKitInstance={coreKitInstance} web3={web3} switchChain={switchChain} />
    </div>
  );
}

export default LoggedinView;
