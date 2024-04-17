import { CHAIN_NAMESPACES } from "@web3auth/base";

export function uiConsole(...args: any[]): void {
  const el = document.querySelector("#console>p");
  if (el) {
    el.innerHTML = JSON.stringify(args || {}, null, 2);
  }
  console.log(...args);
};

export const CHAIN_CONFIGS = {
  SEPOLIA: {
    chainId: "0xaa36a7", // for wallet connect make sure to pass in this chain in the loginSettings of the adapter.
    displayName: "Ethereum Sepolia",
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    tickerName: "Ethereum Sepolia",
    ticker: "ETH",
    decimals: 18,
    rpcTarget: "https://rpc.ankr.com/eth_sepolia",
    blockExplorer: "https://sepolia.etherscan.io",
    logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
  },
  POLYGON: {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: "0x89", // hex of 137, polygon mainnet
    rpcTarget: "https://rpc.ankr.com/polygon",
    // Avoid using public rpcTarget in production.
    // Use services like Infura, Quicknode etc
    displayName: "Polygon Mainnet",
    blockExplorer: "https://polygonscan.com",
    ticker: "MATIC",
    tickerName: "MATIC",
  },
  OPBNB: {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: "0xCC", // hex of 1261120
    rpcTarget: "https://opbnb-mainnet-rpc.bnbchain.org",
    // Avoid using public rpcTarget in production.
    // Use services like Infura, Quicknode etc
    displayName: "opBNB Mainnet",
    blockExplorer: "https://opbnbscan.com",
    ticker: "BNB",
    tickerName: "opBNB",
  },
}
export type CHAIN_NAMESPACE = keyof typeof CHAIN_CONFIGS;
