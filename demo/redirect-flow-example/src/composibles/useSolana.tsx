import { base58, base64 } from "@scure/base";
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, clusterApiUrl } from "@solana/web3.js";
import nacl from "tweetnacl";
import { useState, useEffect } from "react";
import { useCoreKit } from "./useCoreKit";
import { KeyType } from "@tkey/common-types";

const useSolanaRPC = () => {
  const [connection] = useState(new Connection(clusterApiUrl("devnet"), "confirmed"));
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const { coreKitInstance, userInfo } = useCoreKit();

  const getPublicKey = () => {
    if (!coreKitInstance) return;
    const address = base58.encode(Uint8Array.from(coreKitInstance.getPubKeyEd25519()));
    setPublicKey(new PublicKey(address));
    return new PublicKey(address);
  }

  useEffect(() => {
    if (coreKitInstance && coreKitInstance.state.userInfo && coreKitInstance.keyType === KeyType.ed25519 )
      getPublicKey();
  }, [coreKitInstance, userInfo]);

  const getSolanaAccount = async () => {
    try {
      const pubKey = getPublicKey();
      return pubKey?.toBase58() || publicKey?.toBase58() || "";
    } catch (error) {
      return error as string;
    }
  };

  const getSolanaBalance = async (): Promise<string> => {
    try {
      if (!publicKey) throw new Error("Public key is not set");
      const balanceResponse = await connection.getBalance(publicKey);
      return (balanceResponse / LAMPORTS_PER_SOL).toString();
    } catch (error) {
      return error as string;
    }
  };

  const checkBalanceAndMint = async () => {
    try {
      const balance = await getSolanaBalance();
      if (Number(balance) < .1) {
        await requestFaucet();
      }
    } catch (error) {
      console.error("Error checking balance and minting:", error);
    }
  };

  const sendTransactionSolana = async (toPubkey: string, transferAmount: number): Promise<string> => {
    try {
      await checkBalanceAndMint();
      const balance = await getSolanaBalance();
      console.log({ balance });
      if (!publicKey) throw new Error("Public key is not set");
      const getRecentBlockhash = await connection.getLatestBlockhash("confirmed");
      const transferTransaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(toPubkey),
          lamports: transferAmount * LAMPORTS_PER_SOL, // Convert transferAmount to lamports
        })
      );

      transferTransaction.recentBlockhash = getRecentBlockhash.blockhash;
      transferTransaction.feePayer = publicKey;

      const sig = await coreKitInstance.sign(transferTransaction.serializeMessage());

      transferTransaction.addSignature(publicKey, sig);
      const hash = await connection.sendRawTransaction(transferTransaction.serialize());
      return hash;
    } catch (error) {
      return error as string;
    }
  };

  const requestFaucet = async (): Promise<string> => {
    try {
      if (!publicKey) throw new Error("Public key is not set");
      const hash = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
      const latestBlockHash = await connection.getLatestBlockhash();
      const response = await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: hash,
      });
      console.log({ response });
      return hash;
    } catch (error) {
      return error as string;
    }
  };

  const signMessageSolana = async (message: string): Promise<string> => {
    try {
      if (!publicKey) throw new Error("Public key is not set");
      const msg = Buffer.from(message);
      const sig = await coreKitInstance.sign(msg);

      const result = nacl.sign.detached.verify(msg, sig, publicKey.toBytes());

      console.log("Signature verification result:", result);
      return base64.encode(sig);
    } catch (error) {
      return error as string;
    }
  };

  return {
    getSolanaAccount,
    getSolanaBalance,
    sendTransactionSolana,
    requestFaucet,
    signMessageSolana,
    publicKey,
  };
};

export default useSolanaRPC;