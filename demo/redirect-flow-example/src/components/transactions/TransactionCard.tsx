import * as React from "react";
import { useCoreKit } from "../../composibles/useCoreKit";
import { Button } from "../Button";
import { Card } from "../Card";
import { TextField } from "../TextField";
import useUnifiedRPC from "../../composibles/useRpc";
import { KeyType } from "@tkey/common-types";

const TransactionCard: React.FC = () => {
  const [amount, setAmount] = React.useState("0.0001");
  const { setDrawerHeading, setDrawerInfo, coreKitInstance } = useCoreKit();
  const [isLoading, setIsLoading] = React.useState(false);
  const { sendTransaction, account } = useUnifiedRPC();

  const sendWeb3AuthTx = async () => {
    setIsLoading(true);

    try {
      const toAddress = account;
      if (!toAddress) {
        console.error("No account found");
        return;
      }
      const receipt = await sendTransaction(toAddress, amount);
      setDrawerHeading("Send Transaction Result");
      setDrawerInfo(`${receipt}`);
    } catch (error) {
      console.error("Error sending transaction:", error);
      setDrawerHeading(`Send Transaction Result`);
      setDrawerInfo(`Error Sending Transaction: ${(error as Error).message || "Sending Transaction failed"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      <div className="text-center">
        <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Send Transaction</h3>
        <TextField
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          label={`Amount ${coreKitInstance?.keyType === KeyType.ed25519 ? "(SOL)" : "(ETH)"}`}
          placeholder={`Enter amount in ${coreKitInstance?.keyType === KeyType.ed25519 ? "SOL" : "ETH"}`}
          className="mb-4 rounded-md"
          classes={{
            container: "flex flex-col justify-center items-center",
          }}
        />
        <Button disabled={isLoading} loading={isLoading} className="w-full" variant="secondary" onClick={sendWeb3AuthTx}>
          Send Transaction
        </Button>
      </div>
    </Card>
  );
};

export { TransactionCard };
