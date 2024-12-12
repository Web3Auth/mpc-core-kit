import * as React from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { AddShareType, useCoreKit } from "../composibles/useCoreKit";
import { BN } from "bn.js";
import { COREKIT_STATUS } from "@web3auth/mpc-core-kit";
import { useNavigate } from "react-router-dom";

const MfaCard: React.FC = () => {
  const { setAddShareType, coreKitInstance, setCoreKitStatus, existingModules } = useCoreKit();
  const navigate = useNavigate();

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
    await coreKitInstance.logout();
    setCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED)
    navigate("/");
    window.location.reload();
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
        {!existingModules.includes("tssSecurityQuestions") && (
          <Button size="sm" className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white" variant="secondary" onClick={() => addMfa("password")}>
            Add Password
          </Button>
        )}
        {!existingModules.includes("seedPhrase") && (
         <Button size="sm" className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white" variant="secondary" onClick={() => addMfa("phrase")}>
            Add Recovery Phrase
          </Button>
        )}
        {!existingModules.includes("Authenticator") && (
         <Button size="sm" className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white" variant="secondary" onClick={() => addMfa("authenticator")}>
            Add Authenticator Share
          </Button>
        )}
        <Button size="sm" className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white" variant="secondary" onClick={() => criticalReset()}>
          Criticial Reset
        </Button>
      </div>

      <div className="mt-4 mb-0 border-t border-app-gray-200 dark:border-app-gray-500"></div>
    </Card>
  );
};

export { MfaCard };
