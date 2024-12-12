import * as React from "react";
import { Button } from "../../Button";
import { Card } from "../../Card";
import { TextField } from "../../TextField";
import { TssSecurityQuestion } from "@web3auth/mpc-core-kit";
import { useCoreKit } from "../../../composibles/useCoreKit";
import { useNavigate } from "react-router-dom";
import Loader from "../../Loader";

const ConfirmPasswordCard: React.FC = () => {
  const { coreKitInstance, inputBackupFactorKey } = useCoreKit();
  const navigate = useNavigate();
  const [password, setPassword] = React.useState("");
  const securityQuestion = React.useMemo(() => new TssSecurityQuestion(), []);
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

  const confirmSecurityAnswer = async () => {
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
      let factorKey = await securityQuestion.recoverFactor(coreKitInstance, password);
      await inputBackupFactorKey(factorKey);
      navigate("/");
    } catch (error: any) {
      console.error(error);
      if (error.response && error.response.data && error.response.data.code) throw new Error("Generic error");
      setError(error.message || "please enter a valid password");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col justify-center h-[90%] items-center bg-app-gray-100 dark:bg-app-gray-900">
      {isLoading ? (
        <>
          <div className="h-full flex-grow flex flex-col items-center justify-center">
            <Loader size={"lg"} showLogo={true} />
          </div>
        </>
      ) : (
        <Card className="px-8 !h-[250px] w-full flex justify-center items-center py-6 !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
          <div className="text-center">
            <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Confirm Password</h3>
            <TextField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Confirm password"
              className="mb-4"
              classes={{
                container: "flex flex-col justify-center items-center",
              }}
              />
            {error && <p className="text-app-red-400 text-sm mb-4">{error}</p>}
            <Button className="w-full" variant="primary" onClick={confirmSecurityAnswer}>
              Confirm
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export { ConfirmPasswordCard };
