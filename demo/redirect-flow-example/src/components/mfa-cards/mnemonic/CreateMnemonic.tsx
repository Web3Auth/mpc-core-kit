import * as React from "react";
import { Button } from "../../Button";
import { Card } from "../../Card";
import { useCoreKit } from "../../../composibles/useCoreKit";
import { COREKIT_STATUS, FactorKeyTypeShareDescription, generateFactorKey, keyToMnemonic, TssShareType } from "@web3auth/mpc-core-kit";
import BN from "bn.js";

const CreateMnemonicPhraseCard: React.FC = () => {
  const { coreKitInstance, setDrawerHeading, setDrawerInfo, setAddShareType } = useCoreKit();
  const [mnemonic, setMnemonic] = React.useState("");
  const [factorKey, setFactorKey] = React.useState<BN | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const factorKey = generateFactorKey();
    const factorKeyMnemonic = keyToMnemonic(factorKey.private.toString("hex"));
    setMnemonic(factorKeyMnemonic);
    setFactorKey(factorKey.private);
  }, [coreKitInstance]);

  const createMnemonicFactor = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (!coreKitInstance || !factorKey) {
        throw new Error("required fields are not set");
      }

      if (coreKitInstance.getTssFactorPub().length === 1) {
        await coreKitInstance.enableMFA({
          factorKey: factorKey,
          additionalMetadata: { shareType: "SeedPhrase" },
          shareDescription: FactorKeyTypeShareDescription.SeedPhrase,
        });
      } else {
        await coreKitInstance.createFactor({
          shareType: TssShareType.RECOVERY,
          factorKey: factorKey,
          additionalMetadata: { shareType: "SeedPhrase" },
          shareDescription: FactorKeyTypeShareDescription.SeedPhrase,
        });
      }
      
      // await coreKitInstance.enableMFA({}, false)

      console.log("created mnemonice factor share");
      if (coreKitInstance.status === COREKIT_STATUS.LOGGED_IN) {
        await coreKitInstance.commitChanges();
      }
      setDrawerHeading("Seed Phrase");
      setDrawerInfo("Seed phrase has been set successfully");
      setAddShareType("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
    // await inputBackupFactorKey(mnemonic);
  };

  return (
    <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      <div className="text-center">
        <div className="flex flex-col justify-center items-center">
          <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Your Mnemonic Phrase</h3>
          <textarea
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            placeholder="Enter seed phrase"
            className="min-w-[300px] text-center mb-4 w-full p-2 border border-app-gray-300 rounded-md dark:bg-app-gray-700 dark:border-app-gray-600 dark:text-app-white"
            rows={4}
            style={{ resize: "none", whiteSpace: "pre-wrap" }}
          />
        </div>
        <Button loading={isLoading} className="w-full" variant="primary" onClick={createMnemonicFactor}>
          Proceed
        </Button>
      </div>
    </Card>
  );
};

export { CreateMnemonicPhraseCard };
