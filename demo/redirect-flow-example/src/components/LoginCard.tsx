import * as React from "react";
import { Card } from "./Card";
import { Icon } from "./Icon";
import { TextField } from "./TextField";
import { Button } from "./Button";
import { LoginForm } from "./LoginForm";
import { useSocialLogins } from "./useSocialLogin";
import { SocialLoginObj } from "./types";

interface LoginCardProps {
  handleEmailPasswordLess: () => void;
  handleSocialLogin: (item: SocialLoginObj) => void;
}

const LoginCard: React.FC<LoginCardProps> = ({handleEmailPasswordLess, handleSocialLogin}) => {
  const [loginHint, setLoginHint] = React.useState<string>("");

  const socialLogins = useSocialLogins();

  const handlePasswordlessLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("loginHint", loginHint);
    // Handle passwordless login
    handleEmailPasswordLess();
  };

  const handleSocial = (item: SocialLoginObj, index: number) => {
    // Handle social login
    handleSocialLogin(item);
  };

  return (
    <div className="mb-6 mt-24 flex justify-center items-center">
      <Card
        className="dapp-login-modal !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark"
        classes={{ container: "!rounded-2xl p-8" }}
      >
        <div>
          <div className="mb-6 flex justify-center items-center">
            <img className="h-11 w-auto" src="https://images.web3auth.io/web3auth-logo-w.svg" alt="" />
          </div>
          <p className="text-2xl text-center font-bold text-app-gray-900 dark:text-app-white">Welcome to Web3Auth</p>
          <p className="text-base text-center mb-5 text-app-gray-500 dark:text-app-gray-400">Login to continue</p>
        </div>
        <LoginForm
          pill
          socialLogins={socialLogins}
          showInput={false}
          inputExpandBtnProps={{
            pill: true,
            size: "xs",
            className: "!p-0 !h-[1em] active:!ring-0 focus:!ring-0 !rounded-0",
          }}
          socialLoginMessage="By continuing, you agree to our terms and conditions."
          expandLabel="View more"
          collapseLabel="View less"
          primaryBtn="input"
          onSocialLoginClick={ handleSocial }
        >
          <form onSubmit={handlePasswordlessLogin} className="mt-4">
            <TextField
              value={loginHint}
              onChange={(e) => setLoginHint(e.target.value)}
              label="Email"
              pill={true}
              type="email"
              className="w-full rounded-md"
              required
              placeholder="E.g. name@example.com"
            />
            <Button type="submit" className="my-4" variant="primary" block>
              Continue with Email
            </Button>
          </form>
        </LoginForm>
        <div className="flex items-center justify-center mt-8">
          <img src="/assets/ws-trademark-light.svg" alt="web3auth logo" className="block dark:hidden h-5" />
          <img src="/assets/ws-trademark-dark.svg" alt="web3auth logo" className="hidden dark:block h-5" />
        </div>
      </Card>
    </div>
  );
};

export { LoginCard };
