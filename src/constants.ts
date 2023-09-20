import { TORUS_SAPPHIRE_NETWORK } from "@toruslabs/constants";
import { CHAIN_NAMESPACES, CustomChainConfig } from "@web3auth/base";
import { ec as EllipticCurve } from "elliptic";

export const DEFAULT_CHAIN_CONFIG: CustomChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0x5",
  rpcTarget: "https://rpc.ankr.com/eth_goerli",
  displayName: "Goerli Testnet",
  blockExplorer: "https://goerli.etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
  decimals: 18,
};

export const WEB3AUTH_NETWORK = {
  MAINNET: TORUS_SAPPHIRE_NETWORK.SAPPHIRE_MAINNET,
  DEVNET: TORUS_SAPPHIRE_NETWORK.SAPPHIRE_DEVNET,
} as const;

export const USER_PATH = {
  NEW: "NewAccount",
  EXISTING: "ExistingAccount",
  REHYDRATE: "RehydrateAccount",
  RECOVER: "RecoverAccount",
} as const;

export enum FactorKeyTypeShareDescription {
  HashedShare = "hashedShare",
  SecurityQuestions = "tssSecurityQuestions",
  DeviceShare = "deviceShare",
  SeedPhrase = "seedPhrase",
  PasswordShare = "passwordShare",
  SocialShare = "socialShare",
  Other = "Other",
}

export const DELIMITERS = {
  Delimiter1: "\u001c",
  Delimiter2: "\u0015",
  Delimiter3: "\u0016",
  Delimiter4: "\u0017",
};

export const ERRORS = {
  TKEY_SHARES_REQUIRED: "required more shares",
  INVALID_BACKUP_SHARE: "invalid backup share",
};

export const SOCIAL_FACTOR_INDEX = 1;

/**
 * Defines the TSS Share Index in a simplified way for better implementation.
 **/
export enum TssShareType {
  DEVICE = 2,
  RECOVERY = 3,
}

export const VALID_SHARE_INDICES = [TssShareType.DEVICE, TssShareType.RECOVERY];

export const SCALAR_HEX_LEN = 32 * 2; // Length of secp256k1 scalar in hex form.
export const FIELD_ELEMENT_HEX_LEN = 32 * 2; // Length of secp256k1 field element in hex form.
export const CURVE = new EllipticCurve("secp256k1");

export const MAX_FACTORS = 10; // Maximum number of factors that can be added to an account.
export const SOCIAL_TKEY_INDEX = 1;
