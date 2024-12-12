import { useMemo } from "react";
import { LOGIN_PROVIDER, SocialLoginObj } from "./types";

const useSocialLogins = (): SocialLoginObj[] => {

  const socialLoginsAll = useMemo((): SocialLoginObj[] => {
    const loginProviders = Object.values(LOGIN_PROVIDER);
    return loginProviders.map((loginProvider) => ({
      description: loginProvider === LOGIN_PROVIDER.GOOGLE ? "Continue with Google" : "",
      icon: loginProvider,
      verifier: loginProvider,
    }));
  }, []);

  return socialLoginsAll;
};

export { useSocialLogins };