import * as React from "react";
import { useCoreKit } from "../../composibles/useCoreKit";
import { Button } from "../Button";
import { Card, cn } from "../Card";
import { TextField } from "../TextField";
import useUnifiedRPC from "../../composibles/useRpc";
import { KeyType } from "@tkey/common-types";

const TransactionCard: React.FC = () => {
  const [amount, setAmount] = React.useState("0.0001");
  const [toAddress, setToAddress] = React.useState("");
  const { setDrawerHeading, setDrawerInfo, networkName, coin } = useCoreKit();
  const [isLoading, setIsLoading] = React.useState(false);
  const { sendTransaction, account } = useUnifiedRPC();
  const [faucetLink, setFaucetLink] = React.useState("");

  React.useEffect(() => {
    setToAddress(account);
  }, [account]);

  React.useEffect(() => {
    if (networkName === "ETH") {
      setFaucetLink("https://cloud.google.com/application/web3/faucet/ethereum/sepolia");
      setAmount("0.001");
    } else if (networkName === "SOL") {
      setFaucetLink("https://faucet.solana.com/");
      setAmount("0.001");
    } else if (networkName === "BTC") {
      setFaucetLink("https://coinfaucet.eu/en/btc-testnet/");
      setAmount("0.00008");
    }
  }, [networkName]);

  const sendWeb3AuthTx = async () => {
    setIsLoading(true);

    try {
      const sendAddress = toAddress || account;
      if (!sendAddress) {
        console.error("No account found");
        return;
      }
      const receipt = await sendTransaction(sendAddress, amount);
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

  const openFaucet = () => {
    window.open(faucetLink, "blank");
  }

  return (
    <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      <div className="text-center">
        <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-2">Send Transaction</h3>
        <Button variant={"text"} 
          className={cn("text-center w-full text-sm font-medium mb-2")}
          onClick={openFaucet}>
          Visit {networkName} Faucet
        </Button>
        <TextField
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          label={`To Address`}
          placeholder={`Enter To Address`}
          className="mb-4 rounded-md"
          classes={{
            container: "flex flex-col justify-center items-center",
          }}
        />
        <TextField
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          label={`Amount in ${coin}`}
          placeholder={`Enter amount in ${coin}`}
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
