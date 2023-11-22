import { post } from "@toruslabs/http-helpers";
import { keccak256 } from "@toruslabs/metadata-helpers";
import { log } from "@web3auth/base";
import BN from "bn.js";
import type { ec } from "elliptic";

import { CURVE } from "../../constants";
import { IRemoteClientState } from "../../interfaces";
import { Web3AuthMPCCoreKit } from "../../mpcCoreKit";

export class SmsService {
  private backendUrl: string;

  private coreKitInstance: Web3AuthMPCCoreKit;

  private authenticatorType: string = "sms";

  private factorPub: string = "";

  private tssIndex: number;

  constructor(params: { backendUrl: string; coreKitInstance: Web3AuthMPCCoreKit; authenticatorType?: string }) {
    const { backendUrl } = params;
    this.backendUrl = backendUrl;
    this.authenticatorType = params.authenticatorType || "sms";
    this.coreKitInstance = params.coreKitInstance;
    this.getDescriptionsAndUpdate();
  }

  getDescriptionsAndUpdate() {
    const arrayOfDescriptions = Object.entries(this.coreKitInstance.getKeyDetails().shareDescriptions).map(([key, value]) => {
      const parsedDescription = (value || [])[0] ? JSON.parse(value[0]) : {};
      return {
        key,
        description: parsedDescription,
      };
    });

    const shareDescriptionsMobile = arrayOfDescriptions.find(({ description }) => description.authenticator === this.authenticatorType);
    log.info("shareDescriptionsMobile", shareDescriptionsMobile);

    if (shareDescriptionsMobile) {
      this.factorPub = shareDescriptionsMobile.key;
      this.tssIndex = shareDescriptionsMobile.description.tssShareIndex;
    }

    return shareDescriptionsMobile;
  }

  async register(privKey: BN, number: string): Promise<string | undefined> {
    const privKeyPair: ec.KeyPair = CURVE.keyFromPrivate(privKey.toString(16, 64));
    const pubKey = privKeyPair.getPublic();
    const sig = CURVE.sign(keccak256(Buffer.from(number, "utf8")), Buffer.from(privKey.toString(16, 64), "hex"));

    const data = {
      pubKey: {
        x: pubKey.getX().toString(16, 64),
        y: pubKey.getY().toString(16, 64),
      },
      sig: {
        r: sig.r.toString(16, 64),
        s: sig.s.toString(16, 64),
        v: new BN(sig.recoveryParam as number).toString(16, 2),
      },
      number,
    };

    await post<{
      success: boolean;
      id_token?: string;
      message: string;
    }>(`${this.backendUrl}/api/v3/register`, data);

    // this is to send sms to the user instantly after registration.
    const startData = {
      address: `${pubKey.getX().toString(16, 64)}${pubKey.getY().toString(16, 64)}`,
    };

    // Sends the user sms.
    const resp2 = await post<{ success: boolean; code?: string }>(`${this.backendUrl}/api/v3/start`, startData);
    // if (resp2.status !== 200) throw new Error("Error sending sms");
    return resp2.code;
  }

  async addSmsRecovery(address: string, code: string, factorKey: BN) {
    if (!factorKey) throw new Error("factorKey is not defined");
    if (!address) throw new Error("address is not defined");

    const data = {
      address,
      code,
      data: {
        // If the verification is complete, we save the factorKey for the user address.
        // This factorKey is used to verify the user in the future on a new device and recover tss share.
        factorKey: factorKey.toString(16, 64),
      },
    };

    await post(`${this.backendUrl}/api/v3/verify`, data);
  }

  async requestOTP(address: string): Promise<string | undefined> {
    const startData = {
      address,
    };
    const resp2 = await post<{ success?: boolean; code?: string }>(`${this.backendUrl}/api/v3/start`, startData);
    // eslint-disable-next-line no-console
    console.log(resp2);
    return resp2.code;
  }

  async verifyRecovery(address: string, code: string): Promise<BN | undefined> {
    const verificationData = {
      address,
      code,
    };

    const response = await post<{ data?: Record<string, string> }>(`${this.backendUrl}/api/v3/verify`, verificationData);
    const { data } = response;
    return data ? new BN(data.factorKey, "hex") : undefined;
  }

  async verifyRemoteSetup(address: string, code: string): Promise<IRemoteClientState & { tssShareIndex: string }> {
    const verificationData = {
      address,
      code,
    };

    const response = await post<{ data?: Record<string, string> }>(`${this.backendUrl}/api/v3/verify_remote`, verificationData);
    const { data } = response;

    return {
      tssShareIndex: this.tssIndex.toString(),
      remoteClientUrl: this.backendUrl,
      remoteFactorPub: this.factorPub,
      metadataShare: data.metadataShare,
      remoteClientToken: data.signature,
    };
  }
}