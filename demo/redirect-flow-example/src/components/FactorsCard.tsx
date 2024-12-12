import * as React from "react";
import { Card } from "./Card";
import { useCoreKit } from "../composibles/useCoreKit";
import { HiOutlineMail } from "react-icons/hi";
import { ShareDescription } from "./types";
import { HiOutlineKey, HiOutlineLockOpen, HiOutlineDocumentDuplicate } from "react-icons/hi";

const FACTOR_MAP: Record<string, { title: string; icon?: React.ReactNode }> = {
  Authenticator: { title: "Authenticator", icon: <HiOutlineLockOpen className="text-app-gray-900 dark:text-app-white w-5 h-5"/> },
  seedPhrase: { title: "Seed Phrase", icon: <HiOutlineDocumentDuplicate className="text-app-gray-900 dark:text-app-white w-5 h-5"/> },
  tssSecurityQuestions: { title: "Password", icon: <HiOutlineKey className="text-app-gray-900 dark:text-app-white w-5 h-5"/> },
};

const FactorCard: React.FC = () => {
  const { shareDescriptions, userInfo } = useCoreKit();

    return (
    <Card className="px-8 py-6 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      {
        userInfo && (
        <div className="divide-y divide-app-gray-200 dark:divide-app-gray-500">
          <div className="flex items-center py-4">
            <div className="mr-2">
              {["email_passwordless", "jwt"].includes(userInfo.typeOfLogin) ? (
                <HiOutlineMail className="text-app-gray-900 dark:text-app-white w-5 h-5" name="mail-icon" height={20} width={20} />
              ) : (
                <img
                  className="w-5 h-5"
                  src={`https://images.web3auth.io/login-${userInfo.typeOfLogin}-active.svg`}
                  alt={`${userInfo.typeOfLogin} icon`}
                />
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-app-gray-900 dark:text-app-white first-letter:capitalize">{userInfo.typeOfLogin}</h4>
              <p className="text-xs text-app-gray-400">{userInfo.verifierId}</p>
            </div>
          </div>
          {shareDescriptions && shareDescriptions.length > 0 && shareDescriptions.map((shareDescription: ShareDescription) => (
            <div key={shareDescription.module} className="flex items-center py-4">
              <div className="mr-2">
                {/* <Icon name={shareDetail.icon || "key-icon"} className="text-app-gray-900 dark:text-app-white w-5 h-5" /> */}
                {FACTOR_MAP[shareDescription.module].icon}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-app-gray-900 dark:text-app-white">{FACTOR_MAP[shareDescription.module].title}</h4>
                <p className="text-xs text-app-gray-400">{new Date(shareDescription.dateAdded).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
        )
      }
    </Card>
  );
};

export { FactorCard };
