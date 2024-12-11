import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../Button";
import { Card } from "../../Card";
import { useCoreKit } from "../../../composibles/useCoreKit";
import { BN } from "bn.js";
import { COREKIT_STATUS } from "@web3auth/mpc-core-kit";

const RecoveryOptionsCard: React.FC = () => {
  const navigate = useNavigate();
  const { coreKitInstance, setCoreKitStatus } = useCoreKit();

  const handleRecoveryOption = (option: string) => {
    navigate(`/verify-${option}`);
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
  }

  return (
    <div className="w-full flex flex-col justify-center h-[90%] items-center bg-app-gray-100 dark:bg-app-gray-900">
      <Card className="px-8 !h-[300px] flex justify-center items-start py-6 !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
        <div className="text-center">
          <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Choose Recovery Option</h3>
          <Button className="w-full mb-4" variant="primary" onClick={() => handleRecoveryOption("phrase")}>
            Recovery Phrase
          </Button>
          <Button className="w-full mb-4" variant="primary" onClick={() => handleRecoveryOption("authenticator")}>
            Authenticator
          </Button>
          <Button className="w-full mb-4" variant="primary" onClick={() => handleRecoveryOption("password")}>
            Password
          </Button>
          <Button className="w-full mb-4" variant="primary" onClick={() => criticalReset()}>
            Critical Reset
          </Button>
        </div>
      </Card>
    </div>
  );
};

export { RecoveryOptionsCard };
