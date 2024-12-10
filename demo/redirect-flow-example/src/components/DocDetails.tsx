import * as React from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Link } from "./Link";

const DocDetails: React.FC = () => {
  return (
    <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      <div className="mb-4">
        <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-1">
          Experience Web3Auth, first hand
        </h3>
        <p className="text-xs text-app-gray-500 dark:text-app-gray-400">
          Browse our full suite of features for your dApp with our docs. Access code examples for
          these features by visiting our{" "}
          <Link
            href="https://web3auth.io/customers.html"
            className="text-xs dark:text-app-primary-500"
            target="_blank"
            rel="noopener noreferrer"
          >
            playground
          </Link>
          .
        </p>
      </div>
      <div className="space-y-2">
        <Button
          href="https://web3auth.io/docs"
          size="sm"
          className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white"
          variant="secondary"
          rel="noopener noreferrer"
        >
          Read our docs
        </Button>
        <Button
          href="https://web3auth.io/customers"
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