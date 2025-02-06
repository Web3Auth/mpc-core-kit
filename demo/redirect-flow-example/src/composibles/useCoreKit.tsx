import { COREKIT_STATUS, CoreKitMode, makeEthereumSigner, UserInfo, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit } from "@guru_test/mpc-core-kit";
// import { PasskeysPlugin } from "@web3auth/mpc-passkey-plugin";
import React, { createContext, useContext, useState, useEffect } from "react";
import { tssLib as tssLibDkls } from "@toruslabs/tss-dkls-lib";
import { tssLib as tssLibFrostBip340 } from "@toruslabs/tss-frost-lib-bip340";
import { tssLib as tssLibFrost } from "@toruslabs/tss-frost-lib";
import Web3 from "web3";
import { CustomChainConfig, IProvider } from "@web3auth/base";
import { BN } from "bn.js";
import { KeyType } from "@tkey/common-types";
import { EthereumSigningProvider } from "@web3auth/ethereum-mpc-provider";
import { DEFAULT_CHAIN_CONFIG } from "../App";
import { ShareDescription } from "../components/types";

const selectedNetwork = WEB3AUTH_NETWORK.DEVNET;
const initialWeb3AuthConfig = {
  // "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
  // "BHgArYmWwSeq21czpcarYh0EVq2WWOzflX-NTK-tY1-1pauPzHKRRLgpABkmYiIV_og9jAvoIxQ8L3Smrwe04Lw"
  web3AuthClientId: "BHgArYmWwSeq21czpcarYh0EVq2WWOzflX-NTK-tY1-1pauPzHKRRLgpABkmYiIV_og9jAvoIxQ8L3Smrwe04Lw",
  web3AuthNetwork: selectedNetwork,
  uxMode: "popup" as CoreKitMode,
  manualSync: true,
  storage: window.localStorage,
  tssLib: localStorage.getItem("keyType") === KeyType.ed25519 ? tssLibFrost : localStorage.getItem("keyType") === "BTC" as KeyType ? tssLibFrostBip340 : tssLibDkls,
  useDKG: false,
};

export type AddShareType = "phrase" | "authenticator" | "password" | "";

// Define the types for your context values
interface CoreKitContextType {
  coreKitInstance: Web3AuthMPCCoreKit;
  // passkeyPlugin: PasskeysPlugin;
  setCoreKitInstance: (instance: Web3AuthMPCCoreKit) => void;
  // setPasskeyPlugin: (plugin: PasskeysPlugin) => void;
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
  setKeyType: React.Dispatch<React.SetStateAction<KeyType>>;
  keyType: KeyType;
  networkName: "ETH" | "SOL" | "BTC" | undefined;
  coin: "ETH" | "SOL" | "SATS" | undefined;
}

// Create the context with default values
const CoreKitContext = createContext<CoreKitContextType>({
  coreKitInstance: new Web3AuthMPCCoreKit(initialWeb3AuthConfig),
  // passkeyPlugin: new PasskeysPlugin({
  //   baseURL: "https://testing-mpc-passkeys.web3auth.io/api/v1",
  // }),
  setCoreKitInstance: () => { },
  // setPasskeyPlugin?: () => { },
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
  networkName: undefined,
  coin: undefined,
  setKeyType: () => { },
  keyType: localStorage.getItem("keyType") as KeyType || KeyType.secp256k1,
  existingModules: [],
});

// Create a provider component
interface CoreKitProviderProps {
  children: React.ReactNode;
}
export const CoreKitProvider: React.FC<CoreKitProviderProps> = ({ children }) => {
  const possibleModules = ["seedPhrase", "tssSecurityQuestions", "Authenticator"];

  const [coreKitInstance, setCoreKitInstance] = useState<Web3AuthMPCCoreKit>(
    new Web3AuthMPCCoreKit(initialWeb3AuthConfig)
  );
  // const [passkeyPlugin, setPasskeyPlugin] = useState(
  //   new PasskeysPlugin({
  //     baseURL: "https://testing-mpc-passkeys.web3auth.io/api/v1",
  //   })
  // );
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
  const [keyType, setKeyType] = React.useState<KeyType>(localStorage.getItem("keyType") as KeyType || KeyType.secp256k1);
  const [networkName, setNetworkName] = useState<"ETH" | "SOL" | "BTC">();
  const [coin, setCoin] = useState<"ETH" | "SOL" | "SATS">();
  
  useEffect(() => {
    localStorage.setItem("keyType", keyType);
    setNetworkName(keyType === KeyType.secp256k1 ? "ETH" 
      : keyType === KeyType.ed25519 ? "SOL" 
      : "BTC"
    );
    setCoin(keyType === KeyType.secp256k1 ? "ETH" 
      : keyType === KeyType.ed25519 ? "SOL" 
      : "SATS"
    );
    setCoreKitInstance(new Web3AuthMPCCoreKit({
      ...initialWeb3AuthConfig,
      tssLib: keyType === KeyType.secp256k1 ? tssLibDkls : keyType === "BTC" as KeyType ? tssLibFrostBip340 : tssLibFrost,
    }));
  }, [keyType]);

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
          coreKitInstance,
          setCoreKitInstance,
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
          keyType, setKeyType,
          networkName, coin,
      }}>{children}</CoreKitContext.Provider>
  );
};

// Create a custom hook to use the CoreKitContext
export const useCoreKit = () => {
  return useContext(CoreKitContext);
};
