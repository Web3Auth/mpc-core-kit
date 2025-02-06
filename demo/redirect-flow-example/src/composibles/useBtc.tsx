import { useEffect, useState } from "react";
import { networks, Psbt, payments, SignerAsync } from "bitcoinjs-lib";
import ECPairFactory from "ecpair";
import ecc from "@bitcoinerlab/secp256k1";
import * as bitcoinjs from "bitcoinjs-lib";
import axios from "axios";
import { useCoreKit } from "./useCoreKit";
import { createBitcoinJsSigner, createBitcoinJsSignerBip340 } from "./BitcoinSigner";
import { COREKIT_STATUS } from "@guru_test/mpc-core-kit";

bitcoinjs.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

type AddressType = "Taproot" | "Segwit" | "PSBT";

interface Utxo {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
  };
}

const useBtcRPC = () => {
  const [signer, setSigner] = useState<SignerAsync | null>(null);
  const [btcAddress, setBtcAddress] = useState<string>("");
  const [btcBalance, setBtcBalance] = useState<string>("0");
  const { coreKitInstance } = useCoreKit();
  const bitcoinNetwork = networks.testnet;

  useEffect(() => {
    if (coreKitInstance && coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
      const localSigner: SignerAsync = createBitcoinJsSigner({
        coreKitInstance,
        network: bitcoinNetwork,
      });
      setSigner(localSigner);
    }
  }, [coreKitInstance]);

  useEffect(() => {
    getBtcAccount();
    getBtcBalance();
  }, [signer]);

  const getBtcAccount = async (type: AddressType = "Taproot"): Promise<string> => {
    try {
      if (!signer) throw new Error("Signer is not initialized");
      const address = getAddress(signer, type);
      if (!address) throw new Error("Failed to generate address");
      setBtcAddress(address);
      return address;
    } catch (err) {
      return (err as Error).message;
    }
  };

  const getBtcBalance = async (type: AddressType = "Taproot"): Promise<string> => {
    try {
      if (!signer) throw new Error("Signer is not initialized");
      const address = getAddress(signer, type);
      if (!address) throw new Error("Failed to generate address");
      const utxos = await fetchUtxos(address);
      const balanceInSatoshis = utxos.reduce((acc, utxo) => acc + utxo.value, 0);
      const balanceInBtc = (balanceInSatoshis || 0) / 100000000;

      setBtcBalance(balanceInBtc.toString());
      return balanceInBtc.toString();
    } catch (err) {
      return (err as Error).message;
    }
  };

  const sendTransactionBtc = async (
    toAddress: string,
    amountInSatoshis: number,
    type: AddressType = "Taproot",
    broadcast = false
  ): Promise<string> => {
    if (!signer) return "Signer not initialized";
    try {
      const address = getAddress(signer, type);
      if (!address) throw new Error("Failed to generate address");
      const utxos = await fetchUtxos(address);
      if (!utxos.length) throw new Error("No UTXOs found for this address");

      const utxo = utxos[0];
      const fee = await estimateFee();
      const sendAmount = Math.floor(amountInSatoshis * 100000000) || utxo.value - fee;
      const xOnlyPubKey = signer.publicKey.subarray(1, 33);


      const postTransaction = utxo.value - sendAmount - fee;
      if (postTransaction <= 0) {
        throw new Error("Insufficient UTXO value to cover amount + fee");
      }

      const psbt = new Psbt({ network: bitcoinNetwork });

      if (type === "PSBT") {
        const txHex = await fetchTransactionHex(utxo.txid);
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(txHex, "hex"),
        });
      } else {
        const accountOutput = getPaymentOutput(signer, type);
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: accountOutput,
            value: utxo.value,
          },
          tapInternalKey: xOnlyPubKey,
          //   ...(type === "Taproot" ? { tapInternalKey: signer.publicKey.subarray(1, 33) } : {}),
        });
      }
      console.log("psbt.txInputs[0]", psbt.data.inputs);

      psbt.addOutput({
        address: toAddress,
        value: +sendAmount,
      });
      console.log("signing tx");

      if (type === "Taproot") {
        const signerBip340 = createBitcoinJsSignerBip340({
          coreKitInstance,
          network: bitcoinNetwork,
        });
        await psbt.signInputAsync(0, signerBip340);
      } else {
        await psbt.signAllInputsAsync(signer);
        const isValid = psbt.validateSignaturesOfInput(0, btcValidator);
        if (!isValid) throw new Error("Signature validation failed");
      }

      const isValid = psbt.validateSignaturesOfInput(0, btcValidator);
      if (!isValid) throw new Error("Taproot signature validation failed");

      const signedTxHex = psbt.finalizeAllInputs().extractTransaction().toHex();
      console.log("signed tx", signedTxHex, "Copy the above into https://blockstream.info/testnet/tx/push");
      if (broadcast) {
        const txid = await broadcastTx(signedTxHex);
        return `Transaction broadcasted. TXID: ${txid}`;
      }
      return signedTxHex;
    } catch (error) {
      return (error as Error).message;
    }
  };

  /**
   * Sign an arbitrary message using a Taproot (BIP340) or other signer.
   */
  const signMessageBtc = async (message: string, type: AddressType = "Taproot"): Promise<string> => {
    try {
      // const balance = await getBtcBalance();
      // console.log({ balance });
      if (!signer) throw new Error("Signer is not initialized");
      const msg = Buffer.from(message, "utf-8");

      if (type === "Taproot") {
        // Use BIP340 signSchnorr for Taproot
        const signerBip340 = createBitcoinJsSignerBip340({
          coreKitInstance,
          network: bitcoinNetwork,
        });
        if (!signerBip340.signSchnorr) throw new Error("signSchnorr is not defined");
        const signature = await signerBip340.signSchnorr(msg);
        return signature.toString("hex");
      } else {
        // Fall back to standard signing
        const signature = await signer.sign(msg);
        return signature.toString("hex");
      }
    } catch (error) {
      return (error as Error).message;
    }
  };

  const getAddress = (signerObj: SignerAsync, type: AddressType): string | undefined => {
    const paymentOutput = getPaymentOutput(signerObj, type);
    const decodePay = payments.p2tr({ output: paymentOutput, network: bitcoinNetwork }).address; // defaulting to p2tr decode

    if (type === "PSBT") {
      return payments.p2pkh({ pubkey: signerObj.publicKey, network: bitcoinNetwork }).address;
    }
    if (type === "Segwit") {
      return payments.p2wpkh({ pubkey: signerObj.publicKey, network: bitcoinNetwork }).address;
    }
    return decodePay;
  };

  const getPaymentOutput = (signerObj: SignerAsync, type: AddressType): Buffer => {
    const bufPubKey = signerObj.publicKey;
    const xOnlyPubKey = bufPubKey.subarray(1, 33);
    const keyPair = ECPair.fromPublicKey(bufPubKey, { network: bitcoinNetwork });
    const tweak = bitcoinjs.crypto.taggedHash("TapTweak", xOnlyPubKey);
    const tweakedChildNode = keyPair.tweak(tweak);

    if (type === "PSBT") {
      return payments.p2pkh({ pubkey: bufPubKey, network: bitcoinNetwork }).output!;
    }
    if (type === "Segwit") {
      return payments.p2wpkh({ pubkey: bufPubKey, network: bitcoinNetwork }).output!;
    }
    if (type === "Taproot") {
      return payments.p2tr({ pubkey: Buffer.from(tweakedChildNode.publicKey.subarray(1, 33)), network: bitcoinNetwork }).output!;
    }
    return payments.p2tr({
      pubkey: Buffer.from(tweakedChildNode.publicKey.subarray(1, 33)),
      network: bitcoinNetwork,
    }).output!;
  };

  const fetchUtxos = async (address: string): Promise<Utxo[]> => {
    const url = `https://blockstream.info/testnet/api/address/${address}/utxo`;
    const response = await axios.get(url);
    return response.data.filter((utxo: Utxo) => utxo.status.confirmed);
  };

  const fetchTransactionHex = async (txId: string): Promise<string> => {
    const response = await fetch(`https://blockstream.info/testnet/api/tx/${txId}/hex`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transaction hex for ${txId}`);
    }
    return await response.text();
  };

  const estimateFee = async (): Promise<number> => {
    const feeResponse = await axios.get("https://blockstream.info/testnet/api/fee-estimates");
    const maxFee = Math.max(...Object.values(feeResponse.data as Record<string, number>));
    return Math.ceil(maxFee * 1.2);
  };

  const btcValidator = (pubkey: Buffer, msghash: Buffer, signature: Buffer): boolean => {
    return ecc.verifySchnorr(Uint8Array.from(msghash), Uint8Array.from(pubkey), Uint8Array.from(signature));
  };

  const broadcastTx = async (signedTx: string): Promise<string> => {
    const response = await axios.post(`https://blockstream.info/testnet/api/tx`, signedTx);
    return response.data;
  };

  return {
    btcAddress,
    btcBalance,
    getBtcAccount,
    getBtcBalance,
    sendTransactionBtc,
    signMessageBtc,
  };
};

export default useBtcRPC;
