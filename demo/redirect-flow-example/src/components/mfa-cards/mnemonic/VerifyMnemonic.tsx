import * as React from "react";
import { Button } from "../../Button";
import { Card } from "../../Card";
import { useCoreKit } from "../../../composibles/useCoreKit";
import { mnemonicToKey } from "@web3auth/mpc-core-kit";
import { useNavigate } from "react-router-dom";
import Loader from "../../Loader";

const VerifyMnemonicPhraseCard: React.FC = () => {
  const { coreKitInstance, inputBackupFactorKey } = useCoreKit();
  const [mnemonic, setMnemonic] = React.useState("");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const mnemonicToFactorKeyHex = async () => {
    setIsLoading(true);
    setError("");
    if (!mnemonic || !coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    try {
      const factorKey = mnemonicToKey(mnemonic);
      await inputBackupFactorKey(factorKey);
      navigate("/");
      return factorKey;
    } catch (error) {
      setError((error as Error).message || "An error occurred while verifying the mnemonic phrase.");
      console.error(error);
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
              <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Enter Mnemonic Phrase</h3>
              <textarea
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                placeholder="Enter seed phrase"
                className="min-w-[300px] mb-4 w-full p-2 border border-app-gray-300 rounded-md dark:bg-app-gray-700 dark:border-app-gray-600 dark:text-app-white"
                rows={4}
                style={{ resize: "none", whiteSpace: "pre-wrap" }}
              />
              {error && <p className="text-app-red-400 text-sm mb-4">{error}</p>}
              <Button className="w-full" variant="primary" onClick={mnemonicToFactorKeyHex}>
                Proceed
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export { VerifyMnemonicPhraseCard };
