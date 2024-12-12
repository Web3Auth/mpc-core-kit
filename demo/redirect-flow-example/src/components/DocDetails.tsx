import * as React from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Link } from "./Link";

const DocDetails: React.FC = () => {

  const openLink = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      <div className="mb-4">
        <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-1">
          Experience Web3Auth, first hand
        </h3>
        <p className="text-xs text-app-gray-500 dark:text-app-gray-400">
          Browse our full suite of features for your dApp with our docs. Access code examples for
          these features by visiting our{" "}
          
          <button className="leading-none">
            <Link className="text-xs text-app-primary-600" onClick={() => {
              openLink("https://web3auth.io/docs/quick-start?product=MPC_CORE_KIT&sdk=MPC_CORE_KIT_WEB&framework=REACT&stepIndex=0");
            }}>Playground</Link>
          </button>
          .
        </p>
      </div>
      <div className="space-y-2">
        <Button
          onClick={() => {openLink("https://web3auth.io/docs/product/mpc-core-kit")}}
          size="sm"
          className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white"
          variant="secondary"
          rel="noopener noreferrer"
        >
          Read our docs
        </Button>
        <Button
          onClick={() => {openLink("https://github.com/Web3Auth/web3auth-core-kit-examples")}}
          size="sm"
          className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white"
          variant="secondary"
          rel="noopener noreferrer"
        >
          Checkout Live Integrations
        </Button>
      </div>
    </Card>
  );
};

export { DocDetails };