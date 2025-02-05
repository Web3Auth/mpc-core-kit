import * as React from "react";
import { Card } from "./Card";
import { Icon } from "./Icon";
import { TextField } from "./TextField";
import { Button } from "./Button";
import { LoginForm } from "./LoginForm";
import { useSocialLogins } from "./useSocialLogin";
import { SocialLoginObj } from "./types";
import { Dropdown } from "./DropDown";
import { KeyType } from "@tkey/common-types";
import { useCoreKit } from "../composibles/useCoreKit";

interface LoginCardProps {
  handleEmailPasswordLess: (loginHint: string) => void;
  handleSocialLogin: (item: SocialLoginObj) => void;
}

const LoginCard: React.FC<LoginCardProps> = ({ handleEmailPasswordLess, handleSocialLogin }): React.ReactElement => {
  const { setKeyType } = useCoreKit();
  const [loginHint, setLoginHint] = React.useState<string>("");
  const [defaultValue, setDefaultValue] = React.useState(localStorage.getItem("keyType") || KeyType.secp256k1);
  const keyOptions = [
    {
      name: "Ethereum (secp256k1)",
      value: KeyType.secp256k1,
      icon: <img src={"https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=040"} alt={"Ethereum"} width={20} height={20} className="h-5 w-5" />,
    },
    {
      name: "Solana (ed25519)",
      value: KeyType.ed25519,
      icon: <img src={"https://solana.tor.us/img/icon-solana.fb290bef.svg"} alt={"Solana"} width={20} height={20} className="h-5 w-5" />,
    },
    {
      name: "Bitcoin (secp256k1)",
      value: "BTC",
      icon: (
        <img
          src={"https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/128px-Bitcoin.svg.png"}
          alt={"Bitcoin"}
          width={20}
          height={20}
          className="h-5 w-5"
        />
      ),
    },
  ];

  const socialLogins = useSocialLogins();

  const handlePasswordlessLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle passwordless login
    handleEmailPasswordLess(loginHint);
  };

  const handleSocial = (item: SocialLoginObj, index: number) => {
    // Handle social login
    handleSocialLogin(item);
  };

  const handleSwitchKey = (val: string | string[]) => {
    const keyType = val as KeyType;
    if (!keyType || !setKeyType) throw new Error("key type is undefined");
    setKeyType(keyType);
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
          <p className="text-2xl text-start pl-4 font-bold text-app-gray-900 dark:text-app-white">Welcome to Web3Auth</p>
          <div className="flex flex-col gap-y-2 justify-around items-center mt-4">
            <span className="flex flex-row justify-center items-center gap-x-2">
              <p className="text-lg font-bold text-center text-app-gray-500 dark:text-app-gray-400">Your</p>
              <Dropdown
                options={keyOptions}
                defaultValue={defaultValue}
                classes={{
                  container: "w-fit",
                  inputContainer: "bg-app-primary-100 dark:bg-app-primary-500",
                }}
                inputSize="sm"
                onChange={handleSwitchKey}
              />
            </span>
          </div>
          <div className="pl-4 flex flex-col gap-y-2 mb-4">
            <p className="text-lg font-bold text-start text-app-gray-500 dark:text-app-gray-400">Wallet in one Click</p>
            <p className="text-base text-center text-app-gray-500 dark:text-app-gray-400">Login to continue</p>
          </div>
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
          onSocialLoginClick={handleSocial}
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
