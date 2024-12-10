import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../Button";
import { Card } from "../../Card";

const RecoveryOptionsCard: React.FC = () => {
  const navigate = useNavigate();

  const handleRecoveryOption = (option: string) => {
    navigate(`/verify-${option}`);
  };

  return (
    <div className="w-full flex flex-col justify-center h-[90%] items-center bg-app-gray-100 dark:bg-app-gray-900">
      <Card className="px-8 !h-[300px] flex justify-center items-start py-6 !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
        <div className="text-center">
          <h3 className="font-semibold text-app-gray-900 dark:text-app-white mb-4">Choose Recovery Option</h3>
          <Button className="w-full mb-4" variant="primary" onClick={() => handleRecoveryOption("phrase")}>
            Recovery Phrase
          </Button>
          <Button className="w-full mb-4" variant="primary" onClick={() => handleRecoveryOption("authenticator")}>
            Authenticator
          </Button>
          <Button className="w-full mb-4" variant="primary" onClick={() => handleRecoveryOption("password")}>
            Password
          </Button>
        </div>
      </Card>
    </div>
  );
};

export { RecoveryOptionsCard };
