import { ShareSerializationModule } from '@tkey/share-serialization';
import BN from 'bn.js';

/**
 * Converts a mnemonic to a BN.
 * @param shareMnemonic - The mnemonic to convert.
 * @returns A BN respective to your mnemonic
 */
function mnemonicToKey(shareMnemonic) {
  const factorKey = ShareSerializationModule.deserializeMnemonic(shareMnemonic);
  return factorKey.toString("hex");
}

/**
 * Converts a BN to a mnemonic.
 * @param shareBN - The BN to convert.
 * @returns A mnemonic respective to your BN
 */
function keyToMnemonic(shareHex) {
  const shareBN = new BN(shareHex, "hex");
  const mnemonic = ShareSerializationModule.serializeMnemonic(shareBN);
  return mnemonic;
}

export { keyToMnemonic, mnemonicToKey };
