import { useEffect, useMemo, useRef, useState } from "react";
import {
  Web3AuthMPCCoreKit,
  WEB3AUTH_NETWORK,
  SubVerifierDetailsParams,
  TssShareType,
  keyToMnemonic,
  COREKIT_STATUS,
  TssSecurityQuestion,
  generateFactorKey,
  mnemonicToKey,
  parseToken,
  factorKeyCurve,
  makeEthereumSigner,
  SIG_TYPE,
} from "@web3auth/mpc-core-kit";
import { PasskeysPlugin } from "@web3auth/mpc-passkey-plugin";
import Web3 from "web3";
import { CHAIN_NAMESPACES, CustomChainConfig, IProvider } from "@web3auth/base";
import { EthereumSigningProvider } from "@web3auth/ethereum-mpc-provider";
import { BN } from "bn.js";
import { KeyType, Point } from "@tkey/common-types";
import { tssLib as tssLibDkls } from "@toruslabs/tss-dkls-lib";
import{ tssLib as tssLibFrost } from "@toruslabs/tss-frost-lib";
import{ tssLib as tssLibFrostBip340 } from "@toruslabs/tss-frost-lib-bip340";

import bowser from "bowser";



import "./App.css";
import jwt, { Algorithm } from "jsonwebtoken";
import { flow } from "./flow";

type TssLib = typeof tssLibDkls | typeof tssLibFrost | typeof tssLibFrostBip340;
const PASSKEYS_ALLOWED_MAP = [bowser.OS_MAP.iOS, bowser.OS_MAP.MacOS, bowser.OS_MAP.Android, bowser.OS_MAP.Windows];

const getWindowsVersion = (osVersion: string) => {
  const windowsVersionRegex = /NT (\d+\.\d+)/;
  const match = osVersion.match(windowsVersionRegex);
  if (match) return parseInt(match[1], 10);
  return 0;
};


const checkIfOSIsSupported = (osName: string, osVersion: string) => {
  if (!PASSKEYS_ALLOWED_MAP.includes(osName)) return false;
  if (osName === bowser.OS_MAP.MacOS) return true;
  switch (osName) {
    case bowser.OS_MAP.iOS: {
      const version = parseInt(osVersion.split(".")[0], 10);
      return version >= 16;
    }
    case bowser.OS_MAP.Android: {
      const version = parseInt(osVersion.split(".")[0], 10);
      return version >= 9;
    }
    case bowser.OS_MAP.Windows: {
      const version = getWindowsVersion(osVersion);
      return version >= 10;
    }
    default:
      return false;
  }
};

export function shouldSupportPasskey(): { isBrowserSupported: boolean; isOsSupported: boolean; supportedBrowser?: Record<string, string> } {
  const browser = bowser.getParser(navigator.userAgent);
  const osDetails = browser.parseOS();
  if (!osDetails) return { isBrowserSupported: false, isOsSupported: false };
  const osName = osDetails.name || "";
  const result = checkIfOSIsSupported(osName, osDetails.version || "");
  if (!result) return { isBrowserSupported: false, isOsSupported: false };
  const browserData: Record<string, Record<string, string>> = {
    iOS: {
      safari: ">=16",
      chrome: ">=108",
    },
    macOS: {
      safari: ">=16",
      chrome: ">=108",
      firefox: ">=122",
    },
    Android: {
      chrome: ">=108",
    },
    Windows: {
      edge: ">=108",
      chrome: ">=108",
    },
  };
  const isBrowserSupported = browser.satisfies({ ...browserData }) || false;
  return { isBrowserSupported, isOsSupported: true, supportedBrowser: browserData[osName] };
}
const uiConsole = (...args: any[]): void => {
  const el = document.querySelector("#console>p");
  if (el) {
    el.innerHTML = JSON.stringify(args || {}, null, 2);
  }
  console.log(...args);
};

const selectedNetwork = WEB3AUTH_NETWORK.DEVNET;

const DEFAULT_CHAIN_CONFIG: CustomChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0xaa36a7",
  rpcTarget: "https://rpc.ankr.com/eth_sepolia",
  displayName: "Ethereum Sepolia Testnet",
  blockExplorerUrl: "https://sepolia.etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
  decimals: 18,
};


const privateKey = "MEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCCD7oLrcKae+jVZPGx52Cb/lKhdKxpXjl9eGNa1MlY57A==";
const jwtPrivateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
const alg: Algorithm = "ES256";
export const mockLogin = async (email: string) => {
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "torus-key-test",
    aud: "torus-key-test",
    name: email,
    email,
    scope: "email",
    iat,
    eat: iat + 120,
  };

  const algo = {
    expiresIn: 120,
    algorithm: alg,
  };

  const token = jwt.sign(payload, jwtPrivateKey, algo);
  const idToken = token;
  const parsedToken = parseToken(idToken);
  return { idToken, parsedToken };
};

function App() {
  const [mockEmail, setMockEmail] = useState<string | undefined>(undefined);

  const [backupFactorKey, setBackupFactorKey] = useState<string | undefined>(undefined);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [web3, setWeb3] = useState<Web3 | undefined>(undefined);
  const [exportTssShareType, setExportTssShareType] = useState<TssShareType>(TssShareType.DEVICE);
  const [factorPubToDelete, setFactorPubToDelete] = useState<string>("");
  const [coreKitStatus, setCoreKitStatus] = useState<COREKIT_STATUS>(COREKIT_STATUS.NOT_INITIALIZED);
  const [answer, setAnswer] = useState<string | undefined>(undefined);
  const [newAnswer, setNewAnswer] = useState<string | undefined>(undefined);
  const [question, setQuestion] = useState<string | undefined>(undefined);
  const [newQuestion, setNewQuestion] = useState<string | undefined>(undefined);
  const securityQuestion = useMemo(() => new TssSecurityQuestion(), []);
  const [selectedTssLib, setSelectedTssLib] = useState<TssLib>(tssLibDkls);
  const coreKitInstance = useRef<Web3AuthMPCCoreKit>(
    new Web3AuthMPCCoreKit({
        web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
        web3AuthNetwork: selectedNetwork,
        uxMode: "redirect",
        manualSync: true,
        storage: window.localStorage,
        tssLib: selectedTssLib,
        useDKG: false,
      })
  );
  const passkeyPlugin = useRef<PasskeysPlugin | undefined>(
    undefined
    // new PasskeysPlugin(
    //   coreKitInstance.getContext(),
    //   {
    //     baseURL: "https://testing-mpc-passkeys.web3auth.io/api/v1"
    //   }
    // )
  )
  async function setupProvider(chainConfig?: CustomChainConfig) {
    if (coreKitInstance.current.keyType !== KeyType.secp256k1) {
      console.warn(`Ethereum requires keytype ${KeyType.secp256k1}, skipping provider setup`);
      return;
    }
    let localProvider = new EthereumSigningProvider({ config: { chainConfig: chainConfig || DEFAULT_CHAIN_CONFIG } });
    localProvider.setupProvider(makeEthereumSigner(coreKitInstance.current));
    setProvider(localProvider);
  }

  // decide whether to rehydrate session
  const rehydrate = true;
  const init = async (newCoreKitInstance: Web3AuthMPCCoreKit) => {
    coreKitInstance.current = newCoreKitInstance;

    // Example config to handle redirect result manually
    if (newCoreKitInstance.status === COREKIT_STATUS.NOT_INITIALIZED) {
      await newCoreKitInstance.init({ handleRedirectResult: false, rehydrate });
      const pkeyPlugin = new PasskeysPlugin( 
        newCoreKitInstance,
        {
          baseURL: "https://testing-mpc-passkeys.web3auth.io/api/v1"
        });
      await pkeyPlugin.init();
      passkeyPlugin.current = pkeyPlugin;
      debugger;
      if (window.location.hash.includes("#state")) {
        await newCoreKitInstance.handleRedirectResult();
      }
    }
    if (newCoreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
      await setupProvider();
    }

    if (newCoreKitInstance.status === COREKIT_STATUS.REQUIRED_SHARE) {
      uiConsole(
        "required more shares, please enter your backup/ device factor key, or reset account unrecoverable once reset, please use it with caution]"
      );
    }

    console.log("newCoreKitInstance.status", newCoreKitInstance.status);
    setCoreKitStatus(newCoreKitInstance.status);

    try {
      let result = securityQuestion.getQuestion(newCoreKitInstance!);
      setQuestion(result);
      uiConsole("security question set");
    } catch (e) {
      uiConsole("security question not set");
    }
  };

  useEffect(() => {
    const instance =  new Web3AuthMPCCoreKit({
      web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
      web3AuthNetwork: selectedNetwork,
      uxMode: "redirect",
      manualSync: true,
      storage: window.localStorage,
      tssLib: selectedTssLib,
      useDKG: false,
    })
 

    if (instance.status === COREKIT_STATUS.NOT_INITIALIZED)
    {
      init(instance);
    }

  }, [selectedTssLib]);

  useEffect(() => {
    if (provider) {
      const web3 = new Web3(provider as IProvider);
      setWeb3(web3);
    }
  }, [provider]);

  const keyDetails = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    uiConsole(coreKitInstance.current.getKeyDetails());
  };

  const listFactors = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    const factorPubs = coreKitInstance.current.tKey.metadata.factorPubs;
    if (!factorPubs) {
      throw new Error("factorPubs not found");
    }
    const pubsHex = factorPubs[coreKitInstance.current.tKey.tssTag].map(pub => {
      return pub.toSEC1(factorKeyCurve, true).toString("hex");
    });
    uiConsole(pubsHex);
  };

  const loginWithMock = async () => {
    try {
      if (!mockEmail) {
        throw new Error("mockEmail not found");
      }
      const { idToken, parsedToken } = await mockLogin(mockEmail);
      await coreKitInstance.current.loginWithJWT({
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
        prefetchTssPublicKeys: 1,
      });

      if (coreKitInstance.current.status === COREKIT_STATUS.LOGGED_IN) {
        await setupProvider();
      }
      setCoreKitStatus(coreKitInstance.current.status);
    } catch (error: unknown) {
      console.error(error);
    }
  };

  const timedFlow = async () => {
    try {
      if (!mockEmail) {
        throw new Error("mockEmail not found");
      }
      const { idToken, parsedToken } = await mockLogin(mockEmail);
      await flow({
        selectedNetwork,
        manualSync: true,
        setupProviderOnInit: false,
        verifier: "torus-test-health",
        verifierId: parsedToken.email,
        idToken,
      });
    } catch (error: unknown) {
      console.error(error);
    }
  };

  const login = async () => {
    try {
      // Triggering Login using Service Provider ==> opens the popup
      if (!coreKitInstance) {
        throw new Error("initiated to login");
      }
      const verifierConfig = {
        subVerifierDetails: {
          typeOfLogin: "google",
          verifier: "w3a-google-demo",
          clientId: "519228911939-cri01h55lsjbsia1k7ll6qpalrus75ps.apps.googleusercontent.com",
        },
      } as SubVerifierDetailsParams;

      await coreKitInstance.current.loginWithOAuth(verifierConfig);
      setCoreKitStatus(coreKitInstance.current.status);
    } catch (error: unknown) {
      console.error(error);
    }
  };

  const getDeviceShare = async () => {
    const factorKey = await coreKitInstance.current.getDeviceFactor();
    setBackupFactorKey(factorKey);
    uiConsole("Device share: ", factorKey);
  };

  const inputBackupFactorKey = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    if (!backupFactorKey) {
      throw new Error("backupFactorKey not found");
    }
    const factorKey = new BN(backupFactorKey, "hex");
    await coreKitInstance.current.inputFactorKey(factorKey);

    if (coreKitInstance.current.status === COREKIT_STATUS.REQUIRED_SHARE) {
      uiConsole(
        "required more shares even after inputing backup factor key, please enter your backup/ device factor key, or reset account [unrecoverable once reset, please use it with caution]"
      );
    }

    if (coreKitInstance.current.status === COREKIT_STATUS.LOGGED_IN) {
      await setupProvider();
    }

    setCoreKitStatus(coreKitInstance.current.status);
  };

  const recoverSecurityQuestionFactor = async () => {
    if (!coreKitInstance.current) {
      throw new Error("coreKitInstance not found");
    }
    if (!answer) {
      throw new Error("backupFactorKey not found");
    }

    let factorKey = await securityQuestion.recoverFactor(coreKitInstance.current, answer);
    setBackupFactorKey(factorKey);
    uiConsole("Security Question share: ", factorKey);
  };

  const logout = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance not found");
    }
    if (!passkeyPlugin?.current) {
      throw new Error("passkeyPlugin not found");
    }
    await coreKitInstance.current.logout();
    await passkeyPlugin.current.logout(); // TODO: remove this after adding event emitter in mpc core kit
    uiConsole("Log out");
    setProvider(null);
    setCoreKitStatus(coreKitInstance.current.status);
  };

  const getUserInfo = (): void => {
    const user = coreKitInstance?.current.getUserInfo();
    uiConsole(user);
  };

  const exportFactor = async (): Promise<void> => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    uiConsole("export share type: ", exportTssShareType);
    const factorKey = generateFactorKey();
    await coreKitInstance.current.createFactor({
      shareType: exportTssShareType,
      factorKey: factorKey.private,
    });
    let mnemonic = keyToMnemonic(factorKey.private.toString("hex"));
    let key = mnemonicToKey(mnemonic);

    uiConsole("Export factor key: ", factorKey);
    console.log("menmonic : ", mnemonic);
    console.log("key: ", key);
  };

  const deleteFactor = async (): Promise<void> => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    const pubBuffer = Buffer.from(factorPubToDelete, "hex");
    const pub = Point.fromSEC1(factorKeyCurve, pubBuffer.toString("hex"));
    await coreKitInstance.current.deleteFactor(pub);
    uiConsole("factor deleted");
  };

  const getChainID = async () => {
    if (!web3) {
      uiConsole("web3 not initialized yet");
      return;
    }
    const chainId = await web3.eth.getChainId();
    uiConsole(chainId);
    return chainId;
  };

  const setTSSWalletIndex = async (index = 0) => {
    await coreKitInstance.current.setTssWalletIndex(index);
    // log new account details
    await getAccounts();
  };

  const getAccounts = async () => {
    if (!web3) {
      uiConsole("web3 not initialized yet");
      return;
    }
    const address = (await web3.eth.getAccounts())[0];
    uiConsole(address);
    return address;
  };

  const getBalance = async () => {
    if (!web3) {
      uiConsole("web3 not initialized yet");
      return;
    }
    const address = (await web3.eth.getAccounts())[0];
    const balance = web3.utils.fromWei(
      await web3.eth.getBalance(address), // Balance is in wei
      "ether"
    );
    uiConsole(balance);
    return balance;
  };

  const signMessage = async (): Promise<any> => {
    if (coreKitInstance.current.sigType === SIG_TYPE.ECDSA_SECP256K1) {
      if (!web3) {
        uiConsole("web3 not initialized yet");
        return;
      }
      const fromAddress = (await web3.eth.getAccounts())[0];
      const message = "hello";
      const signedMessage = await web3.eth.personal.sign(message, fromAddress, "");
      

      uiConsole(signedMessage);
    } else if (coreKitInstance.current.sigType === SIG_TYPE.ED25519 || coreKitInstance.current.sigType === SIG_TYPE.BIP340) {
      const msg = Buffer.from("hello signer!");
      const sig = await coreKitInstance.current.sign(msg);
      uiConsole(sig.toString("hex"));
    }
  };
  const signMessageWithPrecomputedTss = async (): Promise<any> => {
    if (coreKitInstance.current.keyType === "secp256k1") {
      const precomputedTssClient = await coreKitInstance.current.precompute_secp256k1();
      const msg = Buffer.from("hello signer!");
      const sig = await coreKitInstance.current.sign(msg, false, precomputedTssClient);
      uiConsole(sig.toString("hex"));
    } else if (coreKitInstance.current.keyType === "ed25519") {
      const msg = Buffer.from("hello signer!");
      const sig = await coreKitInstance.current.sign(msg);
      uiConsole(sig.toString("hex"));
    }
  };

  const signMultipleMessagesWithPrecomputedTss = async (): Promise<any> => {
    if (coreKitInstance.current.keyType === "secp256k1") {
      const [precomputedTssClient, precomputedTssClient2] = await Promise.all([coreKitInstance.current.precompute_secp256k1(), coreKitInstance.current.precompute_secp256k1()]);

      const msg = Buffer.from("hello signer!");
      const sig = await coreKitInstance.current.sign(msg, false, precomputedTssClient);
      const msg2 = Buffer.from("hello signer2!");

      const sig2 = await coreKitInstance.current.sign(msg2, false, precomputedTssClient2);
      uiConsole("Sig1: ", sig.toString("hex"), "Sig2: ", sig2.toString("hex"));
    } else if (coreKitInstance.current.keyType === "ed25519") {
      const msg = Buffer.from("hello signer!");
      const sig = await coreKitInstance.current.sign(msg);
      uiConsole(sig.toString("hex"));
    }
  };
  const switchChainSepolia = async () => {
    if (!provider) {
      uiConsole("provider not initialized yet");
      return;
    }
    const newChainConfig = {
      chainId: "0xaa36a7", // for wallet connect make sure to pass in this chain in the loginSettings of the adapter.
      displayName: "Ethereum Sepolia",
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      tickerName: "Ethereum Sepolia",
      ticker: "ETH",
      decimals: 18,
      rpcTarget: "https://rpc.ankr.com/eth_sepolia",
      blockExplorer: "https://sepolia.etherscan.io",
      logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
    };

    if (coreKitInstance.current.status === COREKIT_STATUS.LOGGED_IN) {
      await setupProvider(newChainConfig);
    }
    uiConsole("Changed to Sepolia Network");
  };

  const switchChainPolygon = async () => {
    if (!provider) {
      uiConsole("provider not initialized yet");
      return;
    }
    const newChainConfig = {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: "0x89", // hex of 137, polygon mainnet
      rpcTarget: "https://rpc.ankr.com/polygon",
      // Avoid using public rpcTarget in production.
      // Use services like Infura, Quicknode etc
      displayName: "Polygon Mainnet",
      blockExplorer: "https://polygonscan.com",
      ticker: "MATIC",
      tickerName: "MATIC",
    };
    if (coreKitInstance.current.status === COREKIT_STATUS.LOGGED_IN) {
      await setupProvider(newChainConfig);
    }
    uiConsole("Changed to Sepolia Network");
  };

  const switchChainOPBNB = async () => {
    if (!provider) {
      uiConsole("provider not initialized yet");
      return;
    }

    console.log(provider);
    let newChainConfig = {
      chainId: "0xCC",
      chainName: "BNB",
      nativeCurrency: {
        name: "BNB",
        symbol: "BNB",
        decimals: 18,
      },
      rpcUrls: ["https://opbnb-mainnet-rpc.bnbchain.org"],
      blockExplorerUrls: ["https://opbnbscan.com"],
    };
    await provider.sendAsync({
      method: "wallet_addEthereumChain",
      params: [newChainConfig],
    });
    await provider.sendAsync({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: newChainConfig.chainId }],
    });
    uiConsole("Changed to BNB Network");
  };

  const criticalResetAccount = async (): Promise<void> => {
    // This is a critical function that should only be used for testing purposes
    // Resetting your account means clearing all the metadata associated with it from the metadata server
    // The key details will be deleted from our server and you will not be able to recover your account
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    //@ts-ignore
    // if (selectedNetwork === WEB3AUTH_NETWORK.MAINNET) {
    //   throw new Error("reset account is not recommended on mainnet");
    // }
    await coreKitInstance.current.tKey.storageLayer.setMetadata({
      privKey: new BN(coreKitInstance.current.state.postBoxKey!, "hex"),
      input: { message: "KEY_NOT_FOUND" },
    });
    uiConsole("reset");
    setProvider(null);
  };

  const sendTransaction = async () => {
    if (!web3) {
      uiConsole("web3 not initialized yet");
      return;
    }
    const fromAddress = (await web3.eth.getAccounts())[0];

    const destination = "0x2E464670992574A613f10F7682D5057fB507Cc21";
    const amount = web3.utils.toWei("0.0001", "ether"); // Convert 1 ether to wei

    // Submit transaction to the blockchain and wait for it to be mined
    uiConsole("Sending transaction...");
    const receipt = await web3.eth.sendTransaction({
      from: fromAddress,
      to: destination,
      value: amount,
    });
    uiConsole(receipt);
  };

  const createSecurityQuestion = async (question: string, answer: string) => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await securityQuestion.setSecurityQuestion({ mpcCoreKit: coreKitInstance.current, question, answer, shareType: TssShareType.RECOVERY });
    setNewQuestion(undefined);
    let result = await securityQuestion.getQuestion(coreKitInstance.current);
    if (result) {
      setQuestion(question);
    }
  };

  const changeSecurityQuestion = async (newQuestion: string, newAnswer: string, answer: string) => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await securityQuestion.changeSecurityQuestion({ mpcCoreKit: coreKitInstance.current, newQuestion, newAnswer, answer });
    let result = await securityQuestion.getQuestion(coreKitInstance.current);
    if (result) {
      setQuestion(question);
    }
  };

  const deleteSecurityQuestion = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await securityQuestion.deleteSecurityQuestion(coreKitInstance.current);
    setQuestion(undefined);
  };

  const enableMFA = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    const factorKey = await coreKitInstance.current.enableMFA({});
    const factorKeyMnemonic = await keyToMnemonic(factorKey);

    uiConsole("MFA enabled, device factor stored in local store, deleted hashed cloud key, your backup factor key: ", factorKeyMnemonic);
  };
  const registerPasskey = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    if (!passkeyPlugin?.current) {
      throw new Error("passkeyPlugin is not set");
    }
    const result = shouldSupportPasskey();
    if (!result.isBrowserSupported) {
      uiConsole("Browser not supported");
      return;
    }
    await passkeyPlugin.current.registerPasskey()
  };

  const loginWithPasskey = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    if (!passkeyPlugin?.current) {
      throw new Error("passkeyPlugin is not set");
    }
    const result = shouldSupportPasskey();
    if (!result.isBrowserSupported) {
      uiConsole("Browser not supported");
      return;
    }
    await passkeyPlugin.current.authenticateWithPasskey()
    if (coreKitInstance.current.status === COREKIT_STATUS.LOGGED_IN) {
      await setupProvider();
    }
    setCoreKitStatus(coreKitInstance.current.status);
  };
  const listPasskeys = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    if (!passkeyPlugin?.current) {
      throw new Error("passkeyPlugin is not set");
    }
    const passkeys = await passkeyPlugin.current.listPasskeys()
    uiConsole(passkeys)
  };
  const enableStrictPasskey = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    if (!passkeyPlugin?.current) {
      throw new Error("passkeyPlugin is not set");
    }
    const result = shouldSupportPasskey();
    if (!result.isBrowserSupported) {
      uiConsole("Browser not supported");
      return;
    }
    await passkeyPlugin.current.enableStrictPasskeyAuth()
    uiConsole("Strict Passkey Auth Enabled")
  };
  const disableStrictPasskey = async () => {
    if (!passkeyPlugin?.current) {
      throw new Error("passkeyPlugin not found");
    }
    const isEnabled = await passkeyPlugin.current.isStrictPasskeyEnabled()
    if (!isEnabled) {
      uiConsole("Strict Passkey Auth is not enabled")
      return
    }
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    if (!passkeyPlugin?.current) {
      throw new Error("passkeyPlugin is not set");
    }
    const result = shouldSupportPasskey();
    if (!result.isBrowserSupported) {
      uiConsole("Browser not supported");
      return;
    }
    await passkeyPlugin.current.disableStrictPasskeyAuth()
    uiConsole("Strict Passkey Auth Disabled")
  };
  const commit = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await coreKitInstance.current.commitChanges();
  };

  const tssLibSelector = (
    <div className="flex-container">
      <label>TSS Library:</label>
      <select 
        value={selectedTssLib === tssLibDkls ? "dkls" : selectedTssLib === tssLibFrost ? "frost" : "frostBip340"} 
        onChange={(e) => {
          switch(e.target.value) {
            case "dkls":
              setSelectedTssLib(tssLibDkls);
              break;
            case "frost":
              setSelectedTssLib(tssLibFrost);
              break;
            case "frostBip340":
              setSelectedTssLib(tssLibFrostBip340);
              break;
          }
        }}
      >
        <option value="dkls">DKLS</option>
        <option value="frost">FROST</option>
        <option value="frostBip340">FROST BIP340</option>
      </select>
    </div>
  );

  const loggedInView = (
    <>
      <h2 className="subtitle">Account Details</h2>
      <div className="flex-container">
        <button onClick={getUserInfo} className="card">
          Get User Info
        </button>

        <button onClick={async () => uiConsole(await coreKitInstance.current.getPubKey())} className="card">
          Get Public Key
        </button>

        <button onClick={keyDetails} className="card">
          Key Details
        </button>

        <button onClick={listFactors} className="card">
          List Factors
        </button>

        <button onClick={commit} className="card">
          Commit Changes
        </button>
      </div>
      <div className="flex-container">
        <button onClick={criticalResetAccount} className="card">
          [CRITICAL] Reset Account
        </button>

        <button onClick={async () => uiConsole(await coreKitInstance.current._UNSAFE_exportTssKey())} className="card">
          [CAUTION] Export TSS Private Key
        </button>

        <button onClick={logout} className="card">
          Log Out
        </button>
      </div>
      <h2 className="subtitle">Recovery/ Key Manipulation</h2>
      <div>
        <h4>Enabling MFA</h4>
        <div className="flex-container">
          <button onClick={enableMFA} className="card">
            Enable MFA
          </button>
        </div>

        <h4>Register Passkey</h4>
        <div className="flex-container">
          <button onClick={registerPasskey} className="card">
            Register Passkey
          </button>
          <button onClick={listPasskeys} className="card">
            List Passkeys
          </button>
          <button onClick={enableStrictPasskey} className="card">
            Enable Transaction MFA with Passkey
          </button>
          <button onClick={disableStrictPasskey} className="card">
            Disable Transaction MFA with Passkey
          </button>
        </div>
        <h4>Manual Factors Manipulation</h4>
        <div className="flex-container">
          <label>Share Type:</label>
          <select value={exportTssShareType} onChange={(e) => setExportTssShareType(parseInt(e.target.value))}>
            <option value={TssShareType.DEVICE}>Device Share</option>
            <option value={TssShareType.RECOVERY}>Recovery Share</option>
          </select>
          <button onClick={exportFactor} className="card">
            Export share
          </button>
        </div>
        <div className="flex-container">
          <label>Factor pub:</label>
          <input value={factorPubToDelete} onChange={(e) => setFactorPubToDelete(e.target.value)}></input>
          <button onClick={deleteFactor} className="card">
            Delete Factor
          </button>
        </div>
        <div className="flex-container">
          <input value={backupFactorKey} onChange={(e) => setBackupFactorKey(e.target.value)}></input>
          <button onClick={() => inputBackupFactorKey()} className="card">
            Input Factor Key
          </button>
        </div>

        <h4>Security Question</h4>

        <div>{question}</div>
        <div className="flex-container">
          <div className={question ? " disabledDiv" : ""}>
            <label>Set Security Question:</label>
            <input value={question} placeholder="question" onChange={(e) => setNewQuestion(e.target.value)}></input>
            <input value={answer} placeholder="answer" onChange={(e) => setAnswer(e.target.value)}></input>
            <button onClick={() => createSecurityQuestion(newQuestion!, answer!)} className="card">
              Create Security Question
            </button>
          </div>

          <div className={!question ? " disabledDiv" : ""}>
            <label>Change Security Question:</label>
            <input value={newQuestion} placeholder="newQuestion" onChange={(e) => setNewQuestion(e.target.value)}></input>
            <input value={newAnswer} placeholder="newAnswer" onChange={(e) => setNewAnswer(e.target.value)}></input>
            <input value={answer} placeholder="oldAnswer" onChange={(e) => setAnswer(e.target.value)}></input>
            <button onClick={() => changeSecurityQuestion(newQuestion!, newAnswer!, answer!)} className="card">
              Change Security Question
            </button>
          </div>
        </div>
        <div className="flex-container">
          <div className={!question ? "disabledDiv" : ""}>
            <button onClick={() => deleteSecurityQuestion()} className="card">
              Delete Security Question
            </button>
          </div>
        </div>
      </div>
      <h2 className="subtitle">Blockchain Calls</h2>
      <div className="flex-container">
        <button onClick={getChainID} className="card">
          Get Chain ID
        </button>

        <button onClick={getAccounts} className="card">
          Get Accounts
        </button>

        <button onClick={() => setTSSWalletIndex(1)} className="card">
          Switch to wallet index: 1
        </button>
        <button onClick={() => setTSSWalletIndex(2)} className="card">
          Switch to wallet index: 2
        </button>
        <button onClick={() => setTSSWalletIndex(0)} className="card">
          Switch to wallet index: 0/default
        </button>

        <button onClick={getBalance} className="card">
          Get Balance
        </button>

        <button onClick={signMessage} className="card">
          Sign Message
        </button>

        <button onClick={signMessageWithPrecomputedTss} className="card">
          Sign Msgwith precomputed TSS
        </button>

        <button onClick={signMultipleMessagesWithPrecomputedTss} className="card">
          Sign Multiple MSGs with precomputed TSS
        </button>

        <button onClick={sendTransaction} className="card">
          Send Transaction
        </button>

        <button onClick={switchChainSepolia} className="card">
          switchChainSepolia
        </button>

        <button onClick={switchChainPolygon} className="card">
          switchChainPolygon
        </button>

        <button onClick={switchChainOPBNB} className="card">
          switchChainOPBNB
        </button>
      </div>
    </>
  );

  const unloggedInView = (
    <>
      {tssLibSelector}
      <input value={mockEmail} onChange={(e) => setMockEmail(e.target.value)}></input>
      <button onClick={() => loginWithMock()} className="card">
        MockLogin
      </button>

      <button onClick={loginWithPasskey} className="card">
        Login with Passkey
      </button>

      <button onClick={() => login()} className="card">
        Login
      </button>
      <div className={coreKitStatus === COREKIT_STATUS.REQUIRED_SHARE ? "" : "disabledDiv"}>
        <button onClick={() => getDeviceShare()} className="card">
          Get Device Share
        </button>
        <label>Backup/ Device factor key:</label>
        <input value={backupFactorKey} onChange={(e) => setBackupFactorKey(e.target.value)}></input>
        <button onClick={() => inputBackupFactorKey()} className="card">
          Input Factor Key
        </button>
        <button onClick={criticalResetAccount} className="card">
          [CRITICAL] Reset Account
        </button>

        <div className={!question ? "disabledDiv" : ""}>
          <label>Recover Using Security Answer:</label>
          <label>{question}</label>
          <input value={answer} onChange={(e) => setAnswer(e.target.value)}></input>
          <button onClick={() => recoverSecurityQuestionFactor()} className="card">
            Recover Using Security Answer
          </button>
        </div>
      </div>
      <button onClick={() => timedFlow()} className="card">
        Timed Flow
      </button>
    </>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a target="_blank" href="https://web3auth.io/docs/guides/mpc" rel="noreferrer">
          Web3Auth MPC Core Kit
        </a>{" "}
        Redirect Flow Example
      </h1>

      <div className="grid">{coreKitStatus === COREKIT_STATUS.LOGGED_IN ? loggedInView : unloggedInView}</div>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>

      <footer className="footer">
        <a
          href="https://github.com/Web3Auth/web3auth-core-kit-examples/tree/main/tkey/tkey-mpc-beta-react-popup-example"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source code
        </a>
      </footer>
    </div>
  );
}

export default App;
