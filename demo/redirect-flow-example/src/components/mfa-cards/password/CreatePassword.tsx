import * as React from "react";
import { Button } from "../../Button";
import { Card } from "../../Card";
import { TextField } from "../../TextField";
import { useCoreKit } from "../../../composibles/useCoreKit";
import { COREKIT_STATUS, FactorKeyTypeShareDescription, TssSecurityQuestion, TssShareType } from "@web3auth/mpc-core-kit";

const GetPasswordCard: React.FC = () => {
  const { coreKitInstance, setDrawerHeading, setDrawerInfo, setAddShareType } = useCoreKit();
  const [password, setPassword] = React.useState("");
  const securityQuestion = React.useMemo(() => new TssSecurityQuestion(), []);
  const question = "Enter your password";
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number.";
    }
    if (!/[!@#$%^&*]/.test(password)) {
      return "Password must contain at least one special character.";
    }
    return "";
  };

  const createSecurityQuestion = async () => {
    setIsLoading(true);
    const errorMessage = validatePassword(password);
    if (errorMessage) {
      setError(errorMessage);
      setIsLoading(false);
      return;
    }
    setError("");
    try {
      if (!password) {
        setIsLoading(false);
        return;
      }
      if (!coreKitInstance) {
        throw new Error("coreKitInstance is not set");
      }
      if (coreKitInstance.getTssFactorPub().length === 1) {
        await coreKitInstance.enableMFA({}, false);
      }
      await securityQuestion.setSecurityQuestion({
        mpcCoreKit: coreKitInstance,
        question,
        answer: password,
        shareType: TssShareType.RECOVERY,
      });
      let result = securityQuestion.getQuestion(coreKitInstance);
      console.log("Security Question: ", result);
      if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await coreKitInstance.commitChanges();
      }
      setAddShareType("");
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
          type="password"
          placeholder="Enter password"
          className="mb-4 rounded-lg"
          classes={{
            container: "flex flex-col justify-center items-center",
          }}
        />
        {error && <p className="text-app-red-400 text-sm mb-4">{error}</p>}
        <Button loading={isLoading} className="w-full" variant="primary" onClick={createSecurityQuestion}>
          Proceed
        </Button>
      </div>
    </Card>
  );
};

export { GetPasswordCard };
