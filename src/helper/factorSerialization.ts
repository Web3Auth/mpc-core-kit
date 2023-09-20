import type { ShareSerializationModule } from "@tkey-mpc/share-serialization";
import BN from "bn.js";

import { ICoreKit } from "../interfaces";

/**
 * Converts a mnemonic to a BN.
 * @param tKey - An initialized tKey instance.
 * @param shareMnemonic - The mnemonic to convert.
 * @returns A BN respective to your mnemonic
 */
export async function mnemonicToKey(MPCCoreKit: ICoreKit, shareMnemonic: string): Promise<BN> {
  const factorKey = await (MPCCoreKit.tKey.modules.shareSerialization as ShareSerializationModule).deserialize(shareMnemonic, "mnemonic");
  return factorKey;
}

/**
 * Converts a BN to a mnemonic.
 * @param tKey - An initialized tKey instance.
 * @param shareBN - The BN to convert.
 * @returns A mnemonic respective to your BN
 */
export async function keyToMnemonic(MPCCoreKit: ICoreKit, shareHex: string): Promise<unknown> {
  const shareBN = new BN(shareHex, "hex");
  const mnemonic = await (MPCCoreKit.tKey.modules.shareSerialization as ShareSerializationModule).serialize(shareBN, "mnemonic");
  return mnemonic;
}
