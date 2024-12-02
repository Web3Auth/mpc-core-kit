'use strict';

var constants = require('@toruslabs/constants');

const WEB3AUTH_NETWORK = {
  MAINNET: constants.TORUS_SAPPHIRE_NETWORK.SAPPHIRE_MAINNET,
  DEVNET: constants.TORUS_SAPPHIRE_NETWORK.SAPPHIRE_DEVNET
};
const USER_PATH = {
  NEW: "NewAccount",
  EXISTING: "ExistingAccount",
  REHYDRATE: "RehydrateAccount",
  RECOVER: "RecoverAccount"
};
let FactorKeyTypeShareDescription = /*#__PURE__*/function (FactorKeyTypeShareDescription) {
  FactorKeyTypeShareDescription["HashedShare"] = "hashedShare";
  FactorKeyTypeShareDescription["SecurityQuestions"] = "tssSecurityQuestions";
  FactorKeyTypeShareDescription["DeviceShare"] = "deviceShare";
  FactorKeyTypeShareDescription["SeedPhrase"] = "seedPhrase";
  FactorKeyTypeShareDescription["PasswordShare"] = "passwordShare";
  FactorKeyTypeShareDescription["SocialShare"] = "socialShare";
  FactorKeyTypeShareDescription["Other"] = "Other";
  return FactorKeyTypeShareDescription;
}({});
const DELIMITERS = {
  Delimiter1: "\u001c",
  Delimiter2: "\u0015",
  Delimiter3: "\u0016",
  Delimiter4: "\u0017"
};
const ERRORS = {
  TKEY_SHARES_REQUIRED: "required more shares",
  INVALID_BACKUP_SHARE: "invalid backup share"
};
const SOCIAL_FACTOR_INDEX = 1;

/**
 * Defines the TSS Share Index in a simplified way for better implementation.
 **/
let TssShareType = /*#__PURE__*/function (TssShareType) {
  TssShareType[TssShareType["DEVICE"] = 2] = "DEVICE";
  TssShareType[TssShareType["RECOVERY"] = 3] = "RECOVERY";
  return TssShareType;
}({});
const VALID_SHARE_INDICES = [TssShareType.DEVICE, TssShareType.RECOVERY];
const SCALAR_LEN = 32; // Length of secp256k1 scalar in bytes.
const FIELD_ELEMENT_HEX_LEN = 32 * 2; // Length of secp256k1 field element in hex form.

const MAX_FACTORS = 10; // Maximum number of factors that can be added to an account.
const SOCIAL_TKEY_INDEX = 1;

exports.DELIMITERS = DELIMITERS;
exports.ERRORS = ERRORS;
exports.FIELD_ELEMENT_HEX_LEN = FIELD_ELEMENT_HEX_LEN;
exports.FactorKeyTypeShareDescription = FactorKeyTypeShareDescription;
exports.MAX_FACTORS = MAX_FACTORS;
exports.SCALAR_LEN = SCALAR_LEN;
exports.SOCIAL_FACTOR_INDEX = SOCIAL_FACTOR_INDEX;
exports.SOCIAL_TKEY_INDEX = SOCIAL_TKEY_INDEX;
exports.TssShareType = TssShareType;
exports.USER_PATH = USER_PATH;
exports.VALID_SHARE_INDICES = VALID_SHARE_INDICES;
exports.WEB3AUTH_NETWORK = WEB3AUTH_NETWORK;
