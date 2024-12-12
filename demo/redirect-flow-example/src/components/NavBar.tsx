import * as React from "react";
import { Button } from "./Button";
import { useCoreKit } from "../composibles/useCoreKit";
import { useNavigate } from "react-router-dom";
import { COREKIT_STATUS } from "@web3auth/mpc-core-kit";

const Header: React.FC = () => {
  const { coreKitInstance, setCoreKitStatus, userInfo, setUserInfo, setGlobalLoading } = useCoreKit();
  const [isLogin, setIsLogin] = React.useState(true);
  React.useEffect(() => {
    try {
      if (userInfo) {
        setCoreKitStatus(COREKIT_STATUS.LOGGED_IN);
        setIsLogin(true);
      } else {
        setIsLogin(false);
      }
    } catch (error) {
      console.error(error);
      setIsLogin(false);
    }
  }, [userInfo]);

  const navigate = useNavigate();
  const logout = async () => {
    setGlobalLoading(true);
    try {
      await coreKitInstance.logout();
      setCoreKitStatus(COREKIT_STATUS.NOT_INITIALIZED);
      setUserInfo(undefined);
      navigate("/");
    } catch (error) {
      console.error(error);
    } finally {
      setGlobalLoading(false);
    }
  };

  return (
    <header className="w-full relative">
      <div className="py-4 px-4 sm:py-6 sm:px-8 flex items-center justify-between bg-app-white dark:bg-app-gray-800 w-full">
        <img src="https://demo.web3auth.io/assets/logo-Dbyf1Tt2.svg" alt="web3auth demo logo" className="cursor-pointer h-8 sm:!h-12 w-auto dark:hidden" />
        <img src="/images/logo-light.svg" alt="web3auth demo logo" className="cursor-pointer h-8 sm:!h-12 w-auto hidden dark:block" />
        {!isLogin ? (
          <Button
            id="w3a-documentation"
            href="https://web3auth.io/docs"
            rel="noopener noreferrer"
            className="!h-9 sm:!h-10"
          >
            Documentation
          </Button>
        ) : (
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        )}
      </div>
    </header>
  );
};

export { Header };