'use strict';

var shareSerialization = require('@tkey/share-serialization');
var BN = require('bn.js');

/**
 * Converts a mnemonic to a BN.
 * @param shareMnemonic - The mnemonic to convert.
 * @returns A BN respective to your mnemonic
 */
function mnemonicToKey(shareMnemonic) {
  const factorKey = shareSerialization.ShareSerializationModule.deserializeMnemonic(shareMnemonic);
  return factorKey.toString("hex");
}

/**
 * Converts a BN to a mnemonic.
 * @param shareBN - The BN to convert.
 * @returns A mnemonic respective to your BN
 */
function keyToMnemonic(shareHex) {
  const shareBN = new BN(shareHex, "hex");
  const mnemonic = shareSerialization.ShareSerializationModule.serializeMnemonic(shareBN);
  return mnemonic;
}

exports.keyToMnemonic = keyToMnemonic;
exports.mnemonicToKey = mnemonicToKey;
