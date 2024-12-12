import * as React from "react";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Card } from "./Card";
import { Drawer } from "./Drawer";
import { useCoreKit } from "../composibles/useCoreKit";
import { COREKIT_STATUS, factorKeyCurve } from "@web3auth/mpc-core-kit";
import { HiOutlineDuplicate } from "react-icons/hi";
import { HiOutlineCheckCircle } from "react-icons/hi";
import { Link } from "./Link";

const UserCard: React.FC = () => {
  const { web3, drawerHeading, setDrawerHeading, drawerInfo, setDrawerInfo, userInfo } = useCoreKit();

  const [openConsole, setOpenConsole] = React.useState(false);

  const [isCopied, setIsCopied] = React.useState(false);
  const [account, setAccount] = React.useState<string>("");
  const [imageError, setImageError] = React.useState(false);
  const [currentDrawerHeading, setCurrentDrawerHeading] = React.useState("");
  const [currentDrawerInfo, setCurrentDrawerInfo] = React.useState<any>(null);

  React.useEffect(() => {
    if (drawerHeading) {
      setCurrentDrawerHeading(drawerHeading);
      setDrawerHeading("");
      setOpenConsole(true);
    }
  }, [drawerHeading]);

  React.useEffect(() => {
    if (drawerInfo) {
      setCurrentDrawerInfo(drawerInfo);
      setDrawerInfo("");
      setOpenConsole(true);
    }
  }, [drawerInfo]);

  const getAccounts = async () => {
    if (!web3) {
      return;
    }
    const address = (await web3.eth.getAccounts())[0];
    setAccount(address);
    return address;
  };

  React.useEffect(() => {
    getAccounts();
  }, [userInfo, web3]);

  const handleConsoleBtn = () => {
    setDrawerHeading("User Info Console");
    setDrawerInfo(userInfo);
    setOpenConsole(true);
  };

  const handleCopyAddress = () => {
    setIsCopied(true);
    navigator.clipboard.writeText(account);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  };

  const getTruncateString = (val: string) => {
    const address = val || "";
    return `${address.slice(0, 10)}....${address.slice(address.length - 6)}`;
  };

  const returnAvatarLetter = (name: string) => {
    if (!name) return "W3A";
    if (name.includes("@")) {
      return `${name.charAt(0).toUpperCase()}${name.charAt(1).toUpperCase()}`;
    } else {
      const [nameFirst, nameSecond] = name.split(" ");
      return `${nameFirst?.charAt(0).toUpperCase() || ""}${nameSecond?.charAt(0).toUpperCase() || ""}`;
    }
  };

  return (
    <Card className="px-8 py-6 text-center w-full !rounded-2xl !shadow-modal !border-0 dark:!border-app-gray-800 dark:!shadow-dark">
      {userInfo ? (
        <>
          <Avatar size="xl" className="text-2xl flex-shrink-0 w-[60px] h-[60px] mb-2">
            {userInfo.profileImage && !imageError ? (
              <img
                src={userInfo.profileImage}
                className="w-full h-full"
                alt="Profile"
                onError={() => {
                  setImageError(true);
                }}
              />
            ) : (
              <span>{returnAvatarLetter(userInfo.name)}</span>
            )}
          </Avatar>
          <div>
            <h3 className="font-bold text-app-gray-800 dark:text-app-white mb-2">{userInfo.name}</h3>
            <p className="text-xs text-app-gray-400 mb-1">{userInfo.email ? userInfo.email : userInfo.name}</p>
            <button className="leading-none" onClick={handleConsoleBtn}>
              <Link className="text-xs text-app-primary-600">View User Info</Link>
            </button>
          </div>
          <div className="my-4 border-t border-app-gray-200 dark:border-app-gray-600"></div>
          <div className="space-y-2">
            <Button
              size="sm"
              className="gap-2 w-full !border-app-gray-300 !text-app-gray-800 dark:!text-app-white"
              variant="secondary"
              onClick={handleCopyAddress}
            >
              {getTruncateString(account)}
              <div className="relative">
                {isCopied && (
                  <div className="absolute bottom-[150%] left-1/2 -translate-x-1/2 bg-app-white dark:bg-app-gray-600 py-2 px-4 rounded-lg text-black text-sm text-center w-max shadow-md">
                    Copied
                    <div className="absolute border-8 border-b-0 border-r-transparent border-t-app-white dark:border-t-app-gray-600 border-l-transparent top-[100%] left-[calc(50%_-_8px)]"></div>
                  </div>
                )}
                {isCopied ? (
                  <HiOutlineCheckCircle className={`cursor-pointer ${isCopied ? "text-app-success" : "text-app-gray-800 dark:text-app-white"}`} />
                ) : (
                  <HiOutlineDuplicate className={`cursor-pointer ${isCopied ? "text-app-success" : "text-app-gray-800 dark:text-app-white"}`} />
                )}
              </div>
            </Button>
          </div>
          <Drawer
            open={openConsole}
            backdropCloseIcon={true}
            sidebarCloseIcon={true}
            placement="right"
            classes={{
              container: "!w-full sm:!w-[421px] border-l border-app-gray-200 dark:border-app-gray-500",
              backdropContainer: "absolute opacity-0",
            }}
            onClose={() => setOpenConsole(false)}
          >
            <div className="p-5 flex flex-col flex-1 h-full">
              <h3 className="text-center text-base text-app-gray-600 dark:text-app-white">{currentDrawerHeading}</h3>
              <div className="rounded-2xl p-4 bg-app-gray-100 dark:bg-app-dark-surface2 flex flex-col flex-1 my-6 h-full w-full overflow-x-auto">
                <pre className="text-sm break-words leading-relaxed text-wrap dark:text-app-white">
                  <code>{JSON.stringify(currentDrawerInfo, null, 2)}</code>
                </pre>
              </div>
              <Button block onClick={() => setOpenConsole(false)}>
                Close
              </Button>
            </div>
          </Drawer>
        </>
      ) : (
        <></>
      )}
    </Card>
  );
};

export { UserCard };
