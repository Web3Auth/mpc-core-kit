import { ShareDescriptionMap } from "@tkey/common-types";
import log from "loglevel";

import { RemoteFactorType } from "./remoteSignInterfaces";

export * from "./authenticator";
export * from "./remoteSignInterfaces";
export * from "./smsOtp";

export function getFactorDetailsAndDescriptions(shareDescriptions: ShareDescriptionMap, factorType: RemoteFactorType) {
  const arrayOfDescriptions = Object.entries(shareDescriptions).map(([key, value]) => {
    const parsedDescription = (value || [])[0] ? JSON.parse(value[0]) : {};
    return {
      key,
      description: parsedDescription,
    };
  });

  const shareDescriptionsMobile = arrayOfDescriptions.find(({ description }) => description.authenticator === factorType);
  log.info("shareDescriptionsMobile", shareDescriptionsMobile);

  return { shareDescriptionsMobile, factorPub: shareDescriptionsMobile?.key, tssIndex: shareDescriptionsMobile?.description.tssShareIndex };
}
