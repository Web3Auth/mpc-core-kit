import * as React from "react";
import { useCoreKit } from "../../composibles/useCoreKit";
import { Button } from "../Button";
import { Card } from "../Card";
import { TextField } from "../TextField";

const TransactionCard: React.FC = () => {
  const [amount, setAmount] = React.useState("0.0001");
  const { web3, setDrawerHeading, setDrawerInfo } = useCoreKit();
  const [isLoading, setIsLoading] = React.useState(false);

  const sendTransaction = async () => {
    if (!web3) {
      console.error("web3 not initialized yet");
      return;
    }
    setIsLoading(true);
    const fromAddress = (await web3.eth.getAccounts())[0];

    const destination = "0x2E464670992574A613f10F7682D5057fB507Cc21";
    const value = web3.utils.toWei(amount, "ether"); // Convert amount to wei

    // Submit transaction to the blockchain and wait for it to be mined
    console.log("Sending transaction...");
    try {
      const receipt = await web3.eth.sendTransaction({
        from: fromAddress,
        to: destination,
        value: value,
      });
      console.log(receipt);
      setDrawerHeading("Send Transaction Result");
      const temp = JSON.stringify(
        receipt,
        (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
      );
      setDrawerInfo(`${temp}`);
    } catch (error) {
      console.error("Error sending transaction:", error);
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
          label="Amount (ETH)"
          placeholder="Enter amount in ETH"
          className="mb-4"
          classes={{
            container: "flex flex-col justify-center items-center",
          }}
        />
        <Button disabled={isLoading} loading={isLoading} className="w-full" variant="primary" onClick={sendTransaction}>
          Send Transaction
        </Button>
      </div>
    </Card>
  );
};

export { TransactionCard };
