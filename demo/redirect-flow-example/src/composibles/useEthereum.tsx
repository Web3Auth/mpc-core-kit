import { useState, useEffect } from "react";
import Web3 from "web3";
import { IProvider } from "@web3auth/base";
import axios from "axios";
import { useCoreKit } from "./useCoreKit";

const useEthereumRPC = () => {
  const [ethereumAccount, setEthereumAccount] = useState<string>("");
  const { web3 } = useCoreKit();

  useEffect(() => {
    getEthereumAccount();
  }, [web3]);

  const getEthereumAccount = async () => {
    try {
      if (!web3) throw new Error("Web3 is not set");
      const accounts = await web3.eth.getAccounts();
      setEthereumAccount(accounts[0]);
      return accounts[0];
    } catch (error) {
      console.error("Error getting accounts:", error);
      return "";
    }
  };

  const getEthereumBalance = async (): Promise<string> => {
    try {
      if (!web3 || !ethereumAccount) throw new Error("Web3 or account is not set");
      const balance = await web3.eth.getBalance(ethereumAccount);
      return web3.utils.fromWei(balance, "ether");
    } catch (error) {
      return error as string;
    }
  };

  const sendTransactionEthereum = async (toAddress: string, amount: string): Promise<string> => {
    try {
      await checkBalanceAndMint();
      if (!web3 || !ethereumAccount) throw new Error("Web3 or account is not set");
      const value = web3.utils.toWei(amount, "ether");
      const receipt = await web3.eth.sendTransaction({
        from: ethereumAccount,
        to: toAddress,
        value,
      });
      return JSON.stringify(receipt, (key, value) => (typeof value === "bigint" ? value.toString() : value));
    } catch (error) {
      return error as string;
    }
  };

  const signMessageEthereum = async (message: string): Promise<string> => {
    try {
      if (!web3 || !ethereumAccount) throw new Error("Web3 or account is not set");
      const signedMessage = await web3.eth.personal.sign(message, ethereumAccount, "");
      return signedMessage;
    } catch (error) {
      return error as string;
    }
  };

  const checkBalanceAndMint = async () => {
    try {
      if (!web3) {
        throw new Error("Web3 is not set");
      }
      const address = (await web3.eth.getAccounts())[0];
      const balance = await checkBalance();
      return +balance > 0.001 ? console.log("Balance is less than 0.1 ETH") : await mintCall(address);
    } catch (error) {
      console.error("Error minting:", error);
    }
  };

  const checkBalance = async () => {
    if (!web3) {
      throw new Error("Web3 is not set");
    }
    const address = (await web3.eth.getAccounts())[0];
    const balance = web3.utils.fromWei(await web3.eth.getBalance(address), "ether");
    return balance;
  };

  const mintCall = async (address: string) => {
    const resp = await axios.post(`https://web3pay-staging.web3auth.dev/api/mint`, {
      chainId: "421614",
      toAddress: address,
    });
    return resp;
  };

  return {
    getEthereumAccount,
    getEthereumBalance,
    sendTransactionEthereum,
    signMessageEthereum,
    ethereumAccount,
  };
};

export default useEthereumRPC;