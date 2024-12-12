import { COREKIT_STATUS, makeEthereumSigner, UserInfo, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "@web3auth/mpc-core-kit";
import { PasskeysPlugin } from "@web3auth/mpc-passkey-plugin";
import React, { createContext, useContext, useState, useEffect } from "react";
import { tssLib as tssLibDkls } from "@toruslabs/tss-dkls-lib";
import Web3 from "web3";
import { CustomChainConfig, IProvider } from "@web3auth/base";
import { BN } from "bn.js";
import { KeyType } from "@tkey/common-types";
import { EthereumSigningProvider } from "@web3auth/ethereum-mpc-provider";
import { DEFAULT_CHAIN_CONFIG } from "../App";
import { ShareDescription } from "../components/types";

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
  userInfo?: UserInfo;
  setUserInfo: (userInfo?: UserInfo) => void;
  globalLoading?: boolean;
  setGlobalLoading: (globalLoading: boolean) => void;
  getShareDescriptions: () => void;
  shareDescriptions: ShareDescription[] | null;
  existingModules: string[];
}

// Create the context with default values
const CoreKitContext = createContext<CoreKitContextType>({
  coreKitInstance: new Web3AuthMPCCoreKit({
    web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
    web3AuthNetwork: WEB3AUTH_NETWORK.MAINNET,
    uxMode: "popup",
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
  userInfo: undefined,
  setUserInfo: (userInfo?: UserInfo) => { },
  globalLoading: false,
  setGlobalLoading: (globalLoading: boolean) => { },
  inputBackupFactorKey: async (backupFactorKey: string) => Promise.resolve(),
  getShareDescriptions: () => { },
  shareDescriptions: null,
  existingModules: [],
});

// Create a provider component
interface CoreKitProviderProps {
  children: React.ReactNode;
}

export const CoreKitProvider: React.FC<CoreKitProviderProps> = ({ children }) => {
  const selectedNetwork = WEB3AUTH_NETWORK.MAINNET;
  const possibleModules = ["seedPhrase", "tssSecurityQuestions", "Authenticator"];

  const [coreKitInstance, setCoreKitInstance] = useState<Web3AuthMPCCoreKit>(
    new Web3AuthMPCCoreKit({
      web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
      web3AuthNetwork: selectedNetwork,
      uxMode: "popup",
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
   
  const [userInfo, setUserInfo] = useState<UserInfo>();
  const [drawerHeading, setDrawerHeading] = useState<string>("");
  const [drawerInfo, setDrawerInfo] = useState<any>("");
  const [shareDescriptions, setShareDescriptions] = React.useState<ShareDescription[] | null>(null);
  const [globalLoading, setGlobalLoading] = useState<boolean>(false);
  const [existingModules, setExistingModules] = React.useState<string[]>([]);
  
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

  const getShareDescriptions = () => {
    const moduleList: string[] = [];
    const shareDesc = Object.values(coreKitInstance.tKey.getMetadata().getShareDescription())
      .filter(shareDescription => shareDescription.length > 0)
      .map(shareDescription => {
        try {
          const jsonObject = JSON.parse(shareDescription[0]) as ShareDescription;
          if (!possibleModules.includes(jsonObject.module)) {
            return null;
          }
          moduleList.push(jsonObject.module);
          console.log("Existing Modules: ", [...existingModules, jsonObject.module]);
          return jsonObject;
        } catch (error) {
          console.error('Failed to parse JSON:', error);
          return null; // or handle the error as needed
        }
      })
      .filter(jsonObject => jsonObject !== null);
    setExistingModules(moduleList);
    setShareDescriptions(shareDesc);
  }

  useEffect(() => {
    if (coreKitInstance.state.userInfo)
      getShareDescriptions();
  }, [coreKitInstance, drawerHeading])

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
          userInfo, setUserInfo,
          globalLoading, setGlobalLoading,
          getShareDescriptions,
          shareDescriptions, existingModules,
      }}>{children}</CoreKitContext.Provider>
  );
};

// Create a custom hook to use the CoreKitContext
export const useCoreKit = () => {
  return useContext(CoreKitContext);
};
