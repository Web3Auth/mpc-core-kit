import type ThresholdKey from "@tkey-mpc/core";
import type { ShareSerializationModule } from "@tkey-mpc/share-serialization";
import type BN from "bn.js";

/**
 * Converts a mnemonic to a BN.
 * @param tKey - An initialized tKey instance.
 * @param shareMnemonic - The mnemonic to convert.
 * @returns A BN respective to your mnemonic
 */
export async function mnemonicToKey(tKey: ThresholdKey, shareMnemonic: string): Promise<BN> {
  const factorKey = await (tKey.modules.shareSerialization as ShareSerializationModule).deserialize(shareMnemonic, "mnemonic");
  return factorKey;
}

/**
 * Converts a BN to a mnemonic.
 * @param tKey - An initialized tKey instance.
 * @param shareBN - The BN to convert.
 * @returns A mnemonic respective to your BN
 */
export async function keyToMnemonic(tKey: ThresholdKey, shareBN: BN): Promise<unknown> {
  const mnemonic = await (tKey.modules.shareSerialization as ShareSerializationModule).serialize(shareBN, "mnemonic");
  return mnemonic;
}
