import { useCoreKit } from "./useCoreKit";
import { KeyType } from "@tkey/common-types";
import useSolanaRPC from "./useSolana";
import useEthereumRPC from "./useEthereum";
import React, { useEffect } from "react";

const useUnifiedRPC = () => {
  const { coreKitInstance } = useCoreKit();
  const solanaRPC = useSolanaRPC();
  const ethereumRPC = useEthereumRPC();
  const [account, setAccount] = React.useState<string>("");
  const [balance, setBalance] = React.useState<string>("");

  useEffect(() => {
    if (coreKitInstance.keyType === KeyType.secp256k1) {
      setAccount(ethereumRPC.ethereumAccount);
    } else if (coreKitInstance.keyType === KeyType.ed25519) {
      setAccount(solanaRPC.publicKey?.toBase58() || "");
    }
  }, [solanaRPC.publicKey, ethereumRPC.ethereumAccount, coreKitInstance.keyType]);

  const getAccount = async () => {
    if (coreKitInstance.keyType === KeyType.secp256k1) {
      const result = await ethereumRPC.getEthereumAccount();
      return result;
    } else if (coreKitInstance.keyType === KeyType.ed25519) {
      const result = await solanaRPC.getSolanaAccount();
      return result;
    }
  };

  const getBalance = async () => {
    if (coreKitInstance.keyType === KeyType.secp256k1) {
      return await ethereumRPC.getEthereumBalance();
    } else if (coreKitInstance.keyType === KeyType.ed25519) {
      return await solanaRPC.getSolanaBalance();
    }
    return "0";
  };

  const sendTransaction = async (toAddress: string, amount: string | number) => {
    if (coreKitInstance.keyType === KeyType.secp256k1) {
      return await ethereumRPC.sendTransactionEthereum(toAddress, amount as string);
    } else if (coreKitInstance.keyType === KeyType.ed25519) {
      return await solanaRPC.sendTransactionSolana(toAddress, amount as number);
    }
  };

  const signMessage = async (message: string) => {
    if (coreKitInstance.keyType === KeyType.secp256k1) {
      return await ethereumRPC.signMessageEthereum(message);
    } else if (coreKitInstance.keyType === KeyType.ed25519) {
      return await solanaRPC.signMessageSolana(message);
    }
    return "";
  };

  return {
    getAccount,
    getBalance,
    sendTransaction,
    signMessage,
    account,
  };
};

export default useUnifiedRPC;
