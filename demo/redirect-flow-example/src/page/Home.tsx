import { Card } from "../components/Card";
import { DocDetails } from "../components/DocDetails";
import { Link } from "../components/Link";
import Loader from "../components/Loader";
import { AuthenticatorQRCodeCard } from "../components/mfa-cards/authenticator/AuthenticatorScan";
import { VerifyAuthenticatorCodeCard } from "../components/mfa-cards/authenticator/AuthenticatorVerify";
import { CreateMnemonicPhraseCard } from "../components/mfa-cards/mnemonic/CreateMnemonic";
import { VerifyMnemonicPhraseCard } from "../components/mfa-cards/mnemonic/VerifyMnemonic";
import { ConfirmPasswordCard } from "../components/mfa-cards/password/ConfirmPassword";
import { GetPasswordCard } from "../components/mfa-cards/password/CreatePassword";
import { MfaCard } from "../components/MFACard";
import { PasskeysCard } from "../components/PasskeyCard";
import { SignPersonalMessageCard } from "../components/transactions/SignMessage";
import { TransactionCard } from "../components/transactions/TransactionCard";
import { UserCard } from "../components/UserCard";
import { useCoreKit } from "../composibles/useCoreKit";

const HomePage = () => {
  const { addShareType } = useCoreKit();

  return (
    <div className="flex-1 flex py-4 px-4 sm:py-6 sm:px-10">
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 break-before-avoid w-full">
        {/* actions */}
        <div className="break-inside-avoid space-y-4 mb-4">
          <UserCard />
          <PasskeysCard />
          <MfaCard />
        </div>
        {/* mfa */}
        <div className="break-inside-avoid lg:break-after-avoid xl:break-after-column mb-4 space-y-4">
          {addShareType === "phrase" && <CreateMnemonicPhraseCard />}
          {addShareType === "authenticator" && <AuthenticatorQRCodeCard />}
          {addShareType === "password" && <GetPasswordCard />}
        </div>
        {/* transactions */}
        <div className="break-inside-avoid lg:break-after-avoid xl:break-after-column mb-4 space-y-4">
          <SignPersonalMessageCard />
          <TransactionCard />
        </div>
        {/* documentation */}
        <div className="break-inside-avoid xl:break-after-column mb-4 space-y-4">
          <DocDetails />
          <Card className="px-8 py-6 text-sm text-app-gray-800 dark:text-app-gray-400 w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
            Have any questions?
            <Link
              className="dark:text-app-primary-500"
              href="https://calendly.com/web3auth/meeting-with-web3auth"
              target="_blank"
              rel="noopener noreferrer"
            >
              Schedule a demo call
            </Link>
            with our team today
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
