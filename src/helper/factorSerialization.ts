import { ShareSerializationModule } from "@tkey-mpc/share-serialization";
import BN from "bn.js";

/**
 * Converts a mnemonic to a BN.
 * @param shareMnemonic - The mnemonic to convert.
 * @returns A BN respective to your mnemonic
 */
export async function mnemonicToKey(shareMnemonic: string): Promise<BN> {
  const factorKey = ShareSerializationModule.deserializeMnemonic(shareMnemonic);
  return factorKey;
}

/**
 * Converts a BN to a mnemonic.
 * @param shareBN - The BN to convert.
 * @returns A mnemonic respective to your BN
 */
export async function keyToMnemonic(shareHex: string): Promise<unknown> {
  const shareBN = new BN(shareHex, "hex");
  const mnemonic = ShareSerializationModule.serializeMnemonic(shareBN);
  return mnemonic;
}
