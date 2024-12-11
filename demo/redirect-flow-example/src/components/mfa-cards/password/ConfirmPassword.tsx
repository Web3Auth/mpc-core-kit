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

  const confirmSecurityAnswer = async () => {
    setIsLoading(true);
    try {
      if (!password) {
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
        <Card className="px-8 !h-[300px] w-full flex justify-center items-start py-6 !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
          <div className="text-center">
            <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Confirm Password</h3>
            <TextField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label="Confirm Password"
              type="password"
              placeholder="Confirm password"
              className="mb-4"
              classes={{
                container: "flex flex-col justify-center items-center",
              }}
            />
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
