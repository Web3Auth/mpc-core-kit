import * as React from "react";
import { Button } from "../../Button";
import { Card } from "../../Card";
import { TextField } from "../../TextField";
import { getEcCrypto } from "../../../App";
import { useCoreKit } from "../../../composibles/useCoreKit";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Loader from "../../Loader";

const VerifyAuthenticatorCodeCard: React.FC = () => {
  const authenticatorVerifierUrl = "https://authenticator.web3auth.com";
  const [code, setCode] = React.useState("");
  const { coreKitInstance, inputBackupFactorKey } = useCoreKit();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const verifyExistingAuthenticator = async () => {
    setIsLoading(true);
    setError("");
    try {
      if (!coreKitInstance || !code) {
        throw new Error("coreKitInstance is not set");
      }
      const pubKey = coreKitInstance.tKey.getTSSPub().toSEC1(coreKitInstance.tKey.tssCurve, false);
      const pubKeypoint = getEcCrypto().keyFromPublic(pubKey).getPublic();

      const {
        data: { data: dataFactor },
      } = await axios.post(`${authenticatorVerifierUrl}/api/v1/verify`, {
        address: `${pubKeypoint.getX()?.toString("hex") ?? ""}${pubKeypoint.getY()?.toString("hex") ?? ""}`,
        code,
      });
      await inputBackupFactorKey(dataFactor.factorKey);
      navigate("/");
    } catch (error: any) {
      console.error(error);
      setError((error as Error).message || "An error occurred while verifying the authenticator code.");
      if (error.response && error.response.data && error.response.data.code) throw new Error("Generic error");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="container bg-app-gray-100 dark:bg-app-gray-900">
      {isLoading ? (
        <>
          <div className="h-full flex-grow flex flex-col items-center justify-center">
            <Loader size={"lg"} showLogo={true} />
          </div>
        </>
      ) : (
        <div className="w-full flex flex-col justify-center h-[90%] items-center bg-app-gray-100 dark:bg-app-gray-900">
          <Card className="px-8 !h-[300px] w-full flex justify-center items-start py-6 !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
            <div className="text-center">
              <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Verify Authenticator Code</h3>
              <TextField value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter code" className="mb-4 rounded-md"  classes={{
                container: "flex flex-col justify-center items-center",
              }} />
              {error && <p className="text-app-red-400 text-sm mb-4">{error}</p>}
              <Button className="w-full" variant="primary" onClick={verifyExistingAuthenticator}>
                Verify
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export { VerifyAuthenticatorCodeCard };
