import * as React from "react";
import { Button } from "../../Button";
import { Card } from "../../Card";
import { TextField } from "../../TextField";
import { useCoreKit } from "../../../composibles/useCoreKit";
import { COREKIT_STATUS, FactorKeyTypeShareDescription, TssSecurityQuestion, TssShareType } from "@web3auth/mpc-core-kit";
import { BN } from "bn.js";

const GetPasswordCard: React.FC = () => {
  const { coreKitInstance, setDrawerHeading, setDrawerInfo } = useCoreKit();
  const [password, setPassword] = React.useState("");
  const securityQuestion = React.useMemo(() => new TssSecurityQuestion(), []);
  const question = "Enter your password";
  const [isLoading, setIsLoading] = React.useState(false);

  const createSecurityQuestion = async () => {
    setIsLoading(true);
    try {
      if (!password) {
        return;
      }
      if (!coreKitInstance) {
        throw new Error("coreKitInstance is not set");
      }
      const factorKey = await securityQuestion.setSecurityQuestion({
        mpcCoreKit: coreKitInstance,
        question,
        answer: password,
        shareType: TssShareType.RECOVERY,
      });
      // await coreKitInstance.enableMFA({
      //   factorKey: new BN(factorKey, 16),
      //   additionalMetadata: { "shareType": TssShareType.DEVICE.toString() },
      //   shareDescription: FactorKeyTypeShareDescription.PasswordShare,
      // });
      let result = securityQuestion.getQuestion(coreKitInstance);
      console.log("Security Question: ", result);
      if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await coreKitInstance.commitChanges();
      }
      setDrawerHeading("Security Question");
      setDrawerInfo("Security question has been set successfully");
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      <div className="text-center">
        <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Enter Password</h3>
        <TextField
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          label="Password"
          type="password"
          placeholder="Enter password"
          className="mb-4"
          classes={{
            container: "flex flex-col justify-center items-center",
          }}
        />
        <Button loading={isLoading} className="w-full" variant="primary" onClick={createSecurityQuestion}>
          Proceed
        </Button>
      </div>
    </Card>
  );
};

export { GetPasswordCard };
