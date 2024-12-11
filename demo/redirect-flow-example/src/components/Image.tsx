import * as React from "react";

const DARK_LOGOS_TO_EXCLUDE = ["apple", "github", "twitter-x"];
const LIGHT_LOGOS_TO_EXCLUDE = ["twitter-x"];

interface ImageProps {
  icon: string;
  isPrimary?: boolean;
  isHidden?: boolean;
}

const Image: React.FC<ImageProps> = ({ icon, isPrimary = false, isHidden = false }) => {
  return (
    <div className={isPrimary ? "" : isHidden ? "hidden" : ""}>
      {!isPrimary ? (
        <>
          <img
            loading="lazy"
            className="w-5 h-5 block dark:hidden group-hover:hidden"
            src={`https://images.web3auth.io/login-${icon}-dark.svg`}
            alt={`${icon} Icon`}
          />
          <img
            loading="lazy"
            className="w-5 h-5 dark:block hidden group-hover:hidden"
            src={`https://images.web3auth.io/login-${icon}-light.svg`}
            alt={`${icon} Icon`}
          />
          <img
            loading="lazy"
            className="w-5 h-5 hidden group-hover:block dark:group-hover:hidden"
            src={`https://images.web3auth.io/login-${icon}-${LIGHT_LOGOS_TO_EXCLUDE.includes(icon) ? 'dark' : 'active'}.svg`}
            alt={`${icon} Icon`}
          />
          <img
            loading="lazy"
            className="w-5 h-5 hidden group-hover:hidden dark:group-hover:block"
            src={`https://images.web3auth.io/login-${icon}-${DARK_LOGOS_TO_EXCLUDE.includes(icon) ? 'light' : 'active'}.svg`}
            alt={`${icon} Icon`}
          />
        </>
      ) : (
        <>
          <img
            loading="lazy"
            className="w-5 h-5 hidden dark:block"
            src={`https://images.web3auth.io/login-${icon}-active.svg`}
            alt={`${icon} Icon`}
          />
          <img
            loading="lazy"
            className="w-5 h-5 block dark:hidden"
            src={`https://images.web3auth.io/login-${icon}-${DARK_LOGOS_TO_EXCLUDE.includes(icon) ? 'light' : 'active'}.svg`}
            alt={`${icon} Icon`}
          />
        </>
      )}
    </div>
  );
};

export { Image };