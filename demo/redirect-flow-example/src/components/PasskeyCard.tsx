import * as React from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { useCoreKit } from "../composibles/useCoreKit";
import { shouldSupportPasskey } from "../App";
import { HiOutlineMinusCircle } from "react-icons/hi";
import { HiOutlineKey } from "react-icons/hi";

const PasskeysCard: React.FC = () => {
  const { passkeyPlugin, coreKitInstance } = useCoreKit();
  const [hasPasskeys, setHasPasskeys] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  interface Passkey {
    verifier_id: string;
    verifier: string;
    passkey_pub_key: string;
    label: string;
  }

  const [passkeys, setPasskeys] = React.useState<Passkey[]>([]);

  React.useEffect(() => {
    listPasskeys();
  }, []);

  React.useEffect(() => {
    if (passkeys.length > 0) {
      setHasPasskeys(true);
    }
  }, [passkeys]);

  const deletePasskey = (id: string) => {
    console.log("delete passkey", id);
    passkeyPlugin?.unRegisterPasskey({ credentialPubKey: id, verifier: "web3auth" } as any);
  };

  const registerPasskey = async () => {
    setIsLoading(true);
    try {
      if (!coreKitInstance) {
        throw new Error("coreKitInstance is not set");
      }
      if (!passkeyPlugin) {
        throw new Error("passkeyPlugin is not set");
      }
      const result = shouldSupportPasskey();
      if (!result.isBrowserSupported) {
        console.log("Browser not supported");
        throw new Error("Browser not supported");
      }
      await passkeyPlugin.registerPasskey();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const listPasskeys = async () => {
    try {
      if (!coreKitInstance) {
        throw new Error("coreKitInstance is not set");
      }
      if (!passkeyPlugin) {
        throw new Error("passkeyPlugin is not set");
      }
      const passkeys = await passkeyPlugin.listPasskeys();
      console.log({ passkeyPlugin, passkeys });
      setPasskeys(passkeys);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-semibold text-app-gray-900 dark:text-app-white">Passkeys</h3>
        </div>
        <p className="text-xs text-app-gray-500 dark:text-app-gray-400">Link a passkey to your account</p>
      </div>

      <Button
        size="sm"
        className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white disabled:!text-app-gray-400"
        variant="secondary"
        onClick={registerPasskey}
        loading={isLoading}
      >
        Register a Passkey
      </Button>

      {hasPasskeys && <div className="mt-4 mb-0 border-t border-app-gray-200 dark:border-app-gray-500"></div>}

      {hasPasskeys && (
        <div className="divide-y divide-app-gray-200 dark:divide-app-gray-500">
          {passkeys.map((passkey) => (
            <div key={passkey.label} className="flex items-center py-4">
              <div className="mr-2">
                <HiOutlineKey name="key-icon" className="text-app-gray-900 dark:text-app-white w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-app-gray-900 dark:text-app-white">{passkey.label}</h4>
                <p className="text-xs text-app-gray-400">{passkey.verifier_id}</p>
              </div>
              <div className="ml-auto">
                <Button loading={isLoading} rounded variant="text" onClick={() => deletePasskey(passkey.passkey_pub_key)}>
                  <HiOutlineMinusCircle className="text-app-gray-900 dark:text-app-white w-5 h-5"/>
                  <></>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export { PasskeysCard };
