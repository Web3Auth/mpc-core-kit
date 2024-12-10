import { COREKIT_STATUS, makeEthereumSigner, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "@web3auth/mpc-core-kit";
import { PasskeysPlugin } from "@web3auth/mpc-passkey-plugin";
import React, { createContext, useContext, useState, useEffect } from "react";
import { tssLib as tssLibDkls } from "@toruslabs/tss-dkls-lib";
import Web3 from "web3";
import { CustomChainConfig, IProvider } from "@web3auth/base";
import { BN } from "bn.js";
import { KeyType } from "@tkey/common-types";
import { EthereumSigningProvider } from "@web3auth/ethereum-mpc-provider";
import { DEFAULT_CHAIN_CONFIG } from "../App";

export type AddShareType = "phrase" | "authenticator" | "password" | "";

// Define the types for your context values
interface CoreKitContextType {
  coreKitInstance: Web3AuthMPCCoreKit;
  passkeyPlugin: PasskeysPlugin;
  setCoreKitInstance: (instance: Web3AuthMPCCoreKit) => void;
  setPasskeyPlugin: (plugin: PasskeysPlugin) => void;
  web3: Web3 | undefined;
  setWeb3: (web3: Web3 | undefined) => void;
  provider: IProvider | null;
  setProvider: (provider: IProvider | null) => void;
  setAddShareType: (shareType: AddShareType) => void;
  addShareType: AddShareType;
  coreKitStatus: COREKIT_STATUS;
  setCoreKitStatus: (status: COREKIT_STATUS) => void;
  inputBackupFactorKey: (backupFactorKey: string) => Promise<void>;
  drawerHeading?: string;
  setDrawerHeading: (drawerHeading: string) => void;
  drawerInfo?: any;
  setDrawerInfo: (drawerInfo: any) => void;
}

// Create the context with default values
const CoreKitContext = createContext<CoreKitContextType>({
  coreKitInstance: new Web3AuthMPCCoreKit({
    web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
    web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET,
    uxMode: "redirect",
    manualSync: false,
    storage: window.localStorage,
    tssLib: tssLibDkls,
    useDKG: false,
  }),
  passkeyPlugin: new PasskeysPlugin({
    baseURL: "https://testing-mpc-passkeys.web3auth.io/api/v1",
  }),
  setCoreKitInstance: () => { },
  setPasskeyPlugin: () => { },
  web3: undefined,
  setWeb3: () => { },
  provider: null,
  setProvider: () => { },
  addShareType: "",
  setAddShareType: () => { },
  coreKitStatus: COREKIT_STATUS.NOT_INITIALIZED,
  setCoreKitStatus: (status: COREKIT_STATUS) => { },
  drawerHeading: "",
  setDrawerHeading: (drawerHeading: string) => { },
  drawerInfo: "",
  setDrawerInfo: (drawerInfo: any) => {},
  inputBackupFactorKey: async (backupFactorKey: string) => Promise.resolve(),
});

// Create a provider component
interface CoreKitProviderProps {
  children: React.ReactNode;
}

export const CoreKitProvider: React.FC<CoreKitProviderProps> = ({ children }) => {
  const selectedNetwork = WEB3AUTH_NETWORK.DEVNET;

  const [coreKitInstance, setCoreKitInstance] = useState<Web3AuthMPCCoreKit>(
    new Web3AuthMPCCoreKit({
      web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
      web3AuthNetwork: selectedNetwork,
      uxMode: "redirect",
      manualSync: false,
      storage: window.localStorage,
      tssLib: tssLibDkls,
      useDKG: false,
    })
  );
  const [passkeyPlugin, setPasskeyPlugin] = useState(
    new PasskeysPlugin({
      baseURL: "https://testing-mpc-passkeys.web3auth.io/api/v1",
    })
  );
  const [web3, setWeb3] = useState<Web3 | undefined>(undefined);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [addShareType, setAddShareType] = useState<AddShareType>("");
  const [coreKitStatus, setCoreKitStatus] = useState<COREKIT_STATUS>(COREKIT_STATUS.NOT_INITIALIZED);
   
  const [drawerHeading, setDrawerHeading] = useState<string>("");
  const [drawerInfo, setDrawerInfo] = useState<any>("");
  
  async function setupProvider(chainConfig?: CustomChainConfig) {
    if (coreKitInstance.keyType !== KeyType.secp256k1) {
      console.warn(`Ethereum requires keytype ${KeyType.secp256k1}, skipping provider setup`);
      return;
    }
    let localProvider = new EthereumSigningProvider({ config: { chainConfig: chainConfig || DEFAULT_CHAIN_CONFIG } });
    localProvider.setupProvider(makeEthereumSigner(coreKitInstance));
    setProvider(localProvider);
  }

  const inputBackupFactorKey = async (backupFactorKey: string) => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    if (!backupFactorKey) {
      throw new Error("backupFactorKey not found");
    }
    const factorKey = new BN(backupFactorKey, "hex");
    await coreKitInstance.inputFactorKey(factorKey);
    console.log("inputed backup factor key");
    if (coreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) {
      console.error(
        "required more shares even after inputing backup factor key, please enter your backup/ device factor key, or reset account [unrecoverable once reset, please use it with caution]"
      );
    }

    if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
      await setupProvider();
    }

    setCoreKitStatus(coreKitInstance.status);
  };

  return (
      <CoreKitContext.Provider value={{
          coreKitInstance, passkeyPlugin,
          setCoreKitInstance, setPasskeyPlugin,
          web3, setWeb3,
          provider, setProvider,
          addShareType, setAddShareType,
          setCoreKitStatus, coreKitStatus,
          inputBackupFactorKey,
          drawerHeading, setDrawerHeading,
          drawerInfo, setDrawerInfo,
      }}>{children}</CoreKitContext.Provider>
  );
};

// Create a custom hook to use the CoreKitContext
export const useCoreKit = () => {
  return useContext(CoreKitContext);
};
