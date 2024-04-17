import Web3 from "web3";
import { Web3AuthMPCCoreKit } from "@web3auth/mpc-core-kit";
import { CHAIN_CONFIGS, uiConsole } from "../utils";

interface IBlockchainCalls {
  web3: Web3;
  coreKitInstance: Web3AuthMPCCoreKit;
  switchChain: (namespace: keyof typeof CHAIN_CONFIGS) => void;
}

const BlockchainCalls = ({ web3, coreKitInstance, switchChain }: IBlockchainCalls) => {
  
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

  const setTSSWalletIndex = async (index=0) => {
    coreKitInstance.setTssWalletIndex(index);
    // log new account details 
    await getAccounts();
  }

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

  return (
    <>
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

        <button onClick={() => switchChain('SEPOLIA')} className="card">
          switchChainSepolia
        </button>

        <button onClick={() => switchChain('POLYGON')} className="card">
          switchChainPolygon
        </button>

        <button onClick={() => switchChain('OPBNB')} className="card">
          switchChainOPBNB
        </button>
      </div>
    </>
  )
}

export default BlockchainCalls;
