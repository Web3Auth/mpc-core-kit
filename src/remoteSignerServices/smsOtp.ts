import { secp256k1, ShareDescriptionMap } from "@tkey/common-types";
import { post } from "@toruslabs/http-helpers";
import { keccak256 } from "@toruslabs/metadata-helpers";
import BN from "bn.js";
import type { ec } from "elliptic";
import log from "loglevel";
import { IRemoteClientState } from "src/remoteSignInterfaces";

export class SmsService {
  private backendUrl: string;

  private shareDescriptions: ShareDescriptionMap;

  private authenticatorType: string = "sms";

  private factorPub: string = "";

  private tssIndex: number;

  constructor(params: { backendUrl: string; shareDescriptions: ShareDescriptionMap; authenticatorType?: string }) {
    const { backendUrl } = params;
    this.backendUrl = backendUrl;
    this.authenticatorType = params.authenticatorType || "sms";
    this.shareDescriptions = params.shareDescriptions;
    this.getDescriptionsAndUpdate();
  }

  getDescriptionsAndUpdate() {
    const arrayOfDescriptions = Object.entries(this.shareDescriptions).map(([key, value]) => {
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

  async registerSmsOTP(privKey: BN, number: string): Promise<string | undefined> {
    const privKeyPair: ec.KeyPair = secp256k1.keyFromPrivate(privKey.toString(16, 64));
    const pubKey = privKeyPair.getPublic();
    const sig = secp256k1.sign(keccak256(Buffer.from(number, "utf8")), Buffer.from(privKey.toString(16, 64), "hex"));

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
    }>(`${this.backendUrl}/api/v1/register`, data);

    // this is to send sms to the user instantly after registration.
    const startData = {
      address: `${pubKey.getX().toString(16, 64)}${pubKey.getY().toString(16, 64)}`,
    };

    // Sends the user sms.
    const resp2 = await post<{ success: boolean; code?: string }>(`${this.backendUrl}/api/v1/start`, startData);
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

    await post(`${this.backendUrl}/api/v1/verify`, data);
  }

  async requestSMSOTP(address: string): Promise<string | undefined> {
    const startData = {
      address,
    };
    const resp2 = await post<{ success?: boolean; code?: string }>(`${this.backendUrl}/api/v1/start`, startData);
    // eslint-disable-next-line no-console
    console.log(resp2);
    return resp2.code;
  }

  async verifySMSOTPRecovery(address: string, code: string): Promise<BN | undefined> {
    const verificationData = {
      address,
      code,
    };

    const response = await post<{ data?: Record<string, string> }>(`${this.backendUrl}/api/v1/verify`, verificationData);
    const { data } = response;
    return data ? new BN(data.factorKey, "hex") : undefined;
  }

  async verifyRemoteSetup(address: string, code: string): Promise<IRemoteClientState> {
    const verificationData = {
      address,
      code,
    };

    const response = await post<{ data?: Record<string, string> }>(`${this.backendUrl}/api/v1/verify_remote`, verificationData);
    const { data } = response;

    return {
      tssShareIndex: this.tssIndex,
      remoteClientUrl: this.backendUrl,
      remoteFactorPub: this.factorPub,
      metadataShare: data.metadataShare,
      remoteClientToken: data.signature,
    };
  }
}
