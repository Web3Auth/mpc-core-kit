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
        <div className="flex flex-row gap-x-1.5">
          <img src="https://web3auth.io/images/web3authlog.png" alt="web3auth demo logo" className="cursor-pointer h-8 sm:!h-12 w-auto dark:hidden" />
          <div className="flex flex-col">
            <span className="text-app-gray-900 dark:text-app-white font-semibold text-xl">Web3auth</span>
            <span className="text-app-gray-500 dark:text-app-gray-400 text-sm font-bold">MPC Core Kit Demo</span>
          </div>
        </div>
        {!isLogin ? (
          <Button id="w3a-documentation" href="https://web3auth.io/docs" rel="noopener noreferrer" className="!h-9 sm:!h-10">
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
