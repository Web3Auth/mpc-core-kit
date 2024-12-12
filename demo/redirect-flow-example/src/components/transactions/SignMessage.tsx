import * as React from "react";
import { useCoreKit } from "../../composibles/useCoreKit";
import { Button } from "../Button";
import { Card } from "../Card";
import { SIG_TYPE } from "@toruslabs/constants";

const SignPersonalMessageCard: React.FC = () => {
  const [message, setMessage] = React.useState("Hello World!");
  const { coreKitInstance, setDrawerHeading, setDrawerInfo, web3 } = useCoreKit();
  const [isLoading, setIsLoading] = React.useState(false);

  const signMessage = async () => {
    setIsLoading(true);
    if (!coreKitInstance) {
      console.error("CoreKit instance is not set");
      return;
    }

    try {
      if (coreKitInstance.sigType === SIG_TYPE.ECDSA_SECP256K1) {
        if (!web3) {
          console.log("web3 not initialized yet");
          return;
        }
        const fromAddress = (await web3.eth.getAccounts())[0];
        const message = "hello";
        const signedMessage = await web3.eth.personal.sign(message, fromAddress, "");
        setDrawerHeading("Sign Personal Message");
        setDrawerInfo(`Message has been signed successfully, ${signedMessage.toString()}`);
      } else if (coreKitInstance.sigType === SIG_TYPE.ED25519 || coreKitInstance.sigType === SIG_TYPE.BIP340) {
        const msg = Buffer.from("hello signer!");
        const sig = await coreKitInstance.sign(msg);
        console.log(sig.toString("hex"));
        setDrawerHeading("Sign Personal Message");
        setDrawerInfo(`Message has been signed successfully, ${sig.toString("hex")}`);
      }
    } catch (error) {
      console.error("Error signing message:", error);
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
