import * as React from "react";
import { useCoreKit } from "../../composibles/useCoreKit";
import { Button } from "../Button";
import { Card } from "../Card";
import { SIG_TYPE } from "@toruslabs/constants";
import useUnifiedRPC from "../../composibles/useRpc";

const SignPersonalMessageCard: React.FC = () => {
  const [message, setMessage] = React.useState("Hello World!");
  const { coreKitInstance, setDrawerHeading, setDrawerInfo } = useCoreKit();
  const [isLoading, setIsLoading] = React.useState(false);
  const { signMessage: signMessageFunction } = useUnifiedRPC();

  const signMessage = async () => {
    setIsLoading(true);
    if (!coreKitInstance) {
      console.error("CoreKit instance is not set");
      return;
    }

    try {
      const signedMessage = await signMessageFunction(message);
      setDrawerHeading(`Sign Personal Message ${coreKitInstance.sigType}`);
      setDrawerInfo(`Message has been signed successfully, ${signedMessage.toString()}`);
    } catch (error) {
      console.error("Error signing message:", error);
      setDrawerHeading(`Sign Personal Message ${coreKitInstance.sigType}`);
      setDrawerInfo(`Error signing message: ${(error as Error).message || "Message signing failed"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      <div className="text-center">
        <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Sign Personal Message</h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message"
          className="min-w-[80%] mb-4 w-full p-2 border border-app-gray-300 rounded-md dark:bg-app-gray-700 dark:border-app-gray-600 dark:text-app-white"
          rows={4}
          style={{ resize: "none", whiteSpace: "pre-wrap" }}
        />
        <Button disabled={isLoading} loading={isLoading} className="w-full" variant="secondary" onClick={signMessage}>
          Sign Message
        </Button>
      </div>
    </Card>
  );
};

export { SignPersonalMessageCard };
