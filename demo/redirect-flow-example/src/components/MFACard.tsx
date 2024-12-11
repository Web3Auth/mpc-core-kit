import * as React from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { AddShareType, useCoreKit } from "../composibles/useCoreKit";
import { BN } from "bn.js";
import { HiOutlineMail } from "react-icons/hi";

const FACTOR_MAP: Record<string, { title: string; icon?: string }> = {
  device: { title: "Device", icon: "mobile-icon" },
  seedPhrase: { title: "Recovery Phrase", icon: "key-solid-icon" },
  social: { title: "Social Recovery Factor", icon: "key-solid-icon" },
  password: { title: "Password", icon: "key-solid-icon" },
};


const shareDetails = [
  // Example share details
  { shareType: "device", details: "Chrome 91 (Windows)" },
  { shareType: "seedPhrase", details: "Recovery Phrase" },
].map((share) => ({
  title: FACTOR_MAP[share.shareType]?.title || "",
  details: share.details,
  icon: FACTOR_MAP[share.shareType]?.icon || "",
}));

const MfaCard: React.FC = () => {
  const { setAddShareType, coreKitInstance } = useCoreKit();
  const [userInfo, setUserInfo] = React.useState<any>({});

  React.useEffect(() => {
    const fetchUserInfo = async () => {
      if (!coreKitInstance) {
        return;
      }
      const userInfo = await coreKitInstance.getUserInfo();
      setUserInfo(userInfo);
    };
    fetchUserInfo();
  }, [coreKitInstance]);

  const addMfa = (addShareType: AddShareType) => {
    console.log("Add MFA");
    setAddShareType(addShareType);
  };

  const criticalReset = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    //@ts-ignore
    // if (selectedNetwork === WEB3AUTH_NETWORK.MAINNET) {
    //   throw new Error("reset account is not recommended on mainnet");
    // }
    await coreKitInstance.tKey.storageLayer.setMetadata({
      privKey: new BN(coreKitInstance.state.postBoxKey!, "hex"),
      input: { message: "KEY_NOT_FOUND" },
    });
  }

  return (
    <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-semibold text-app-gray-900 dark:text-app-white">MFA</h3>
          {/* <Badge variant={userInfo.isMfaEnabled ? "success" : "default"}>
            {userInfo.isMfaEnabled ? "Enabled" : "Disabled"}
          </Badge> */}
        </div>
        <p className="text-xs text-app-gray-500 dark:text-app-gray-400">
          Add an additional security layer to your wallets. While enabled, you will need to verify another factor when logging in.
        </p>
      </div>

      <div className="flex flex-col gap-y-2">
        <Button size="sm" className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white" variant="secondary" onClick={() => addMfa("password")}>
          Add Password
        </Button>
        <Button size="sm" className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white" variant="secondary" onClick={() => addMfa("phrase")}>
          Add Recovery Phrase
        </Button>
        <Button size="sm" className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white" variant="secondary" onClick={() => addMfa("authenticator")}>
          Add Authenticator Share
        </Button>
        <Button size="sm" className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white" variant="secondary" onClick={() => criticalReset()}>
          Criticial Reset
        </Button>
      </div>

      <div className="mt-4 mb-0 border-t border-app-gray-200 dark:border-app-gray-500"></div>

      <div className="divide-y divide-app-gray-200 dark:divide-app-gray-500">
        <div className="flex items-center py-4">
          <div className="mr-2">
            {["email_passwordless", "jwt"].includes(userInfo.typeOfLogin) ? (
              <HiOutlineMail className="text-app-gray-900 dark:text-app-white w-5 h-5" name="mail-icon" height={20} width={20} />
            ) : (
              <img
                className="w-5 h-5"
                src={`https://images.web3auth.io/login-${userInfo.typeOfLogin}-active.svg`}
                alt={`${userInfo.typeOfLogin} icon`}
              />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-app-gray-900 dark:text-app-white first-letter:capitalize">{userInfo.typeOfLogin}</h4>
            <p className="text-xs text-app-gray-400">{userInfo.verifierId}</p>
          </div>
        </div>
        {
          // shareDetails.map((shareDetail) => (
          // <div key={shareDetail.title} className="flex items-center py-4">
          //   <div className="mr-2">
          //     {/* <Icon name={shareDetail.icon || "key-icon"} className="text-app-gray-900 dark:text-app-white w-5 h-5" /> */}
          //   </div>
          //   <div>
          //     <h4 className="text-sm font-semibold text-app-gray-900 dark:text-app-white">{shareDetail.title}</h4>
          //     <p className="text-xs text-app-gray-400">{shareDetail.details}</p>
          //   </div>
          // </div>
          // ))
        }
      </div>
    </Card>
  );
};

export { MfaCard };
