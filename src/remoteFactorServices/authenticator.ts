import { Point, secp256k1 } from "@tkey/common-types";
import { generatePrivateBN } from "@tkey/core";
import { post } from "@toruslabs/http-helpers";
import { keccak256 } from "@toruslabs/metadata-helpers";
import BN from "bn.js";
import base32 from "hi-base32";

import { WEB3AUTH_NETWORK_TYPE, Web3AuthMPCCoreKit } from "../";
import { IRemoteClientState } from "./remoteSignInterfaces";

// todo, to replace with ICorekit
export function registerAuthenticatorService(_params: { backendUrl: string; secret: string; corekitInstance: Web3AuthMPCCoreKit }) {
  // corekitInstance create factor
  // sign secret with the corekit
  // AuthenticatorService register
}

// generate secret key for authenticator
export function generateSecretKey(): string {
  const key = generatePrivateBN().toArray().slice(0, 20);
  return base32.encode(key).toString().replace(/=/g, "");
}

export class AuthenticatorService {
  public factorKey?: BN;

  // publickey
  public factorPub?: string;

  private backendUrl: string;

  private web3authNetwork: WEB3AUTH_NETWORK_TYPE;

  private metadataUrl?: string;

  constructor(params: { backendUrl: string; web3authNetwork: WEB3AUTH_NETWORK_TYPE; overrideMetadataUrl?: string }) {
    const { backendUrl } = params;
    this.backendUrl = backendUrl;
    this.web3authNetwork = params.web3authNetwork;
    this.metadataUrl = params.overrideMetadataUrl;
  }

  async register(secretKey: string, factorKey: string): Promise<{ success: boolean; message?: string }> {
    // get pubkey
    const privKeyPair = secp256k1.keyFromPrivate(factorKey);
    const pubKey = privKeyPair.getPublic();
    const point = Point.fromElliptic(pubKey);
    // sign secret
    const sig = secp256k1.sign(keccak256(Buffer.from(secretKey, "utf8")), privKeyPair.getPrivate().toBuffer());

    const data = {
      address: point.toSEC1(secp256k1, true).toString("hex"),
      sig: {
        r: sig.r.toString("hex").padStart(64, "0"),
        s: sig.s.toString("hex").padStart(64, "0"),
        v: new BN(sig.recoveryParam).toString(16, 2),
      },
      secretKey,
    };

    const resp = await post<{
      success: boolean;
      message: string;
    }>(`${this.backendUrl}/api/v3/register`, data);

    this.factorKey = new BN(factorKey, "hex");
    this.factorPub = point.toSEC1(secp256k1, true).toString("hex");

    return resp;
  }

  async verifyRegistration(code: string) {
    if (!this.factorKey) throw new Error("factorKey is not defined");
    if (!this.factorPub) throw new Error("address is not defined");
    if (!code) throw new Error("code is not defined");

    const data = {
      address: this.factorPub.replaceAll("0x", ""),
      code,
      data: {
        // If the verification is complete, we save the factorKey for the user address.
        // This factorKey is used to verify the user in the future on a new device and recover tss share.
        factorKey: this.factorKey.toString(16, 64),
      },
    };

    await post(`${this.backendUrl}/api/v3/verify`, data);
  }

  // Verify the mfa code and return the factorKey
  async verifyAuthenticatorRecovery(factorPub: string, code: string): Promise<BN | undefined> {
    const verificationData = {
      address: factorPub,
      code,
    };

    const response = await post<{ data?: Record<string, string> }>(`${this.backendUrl}/api/v3/verify`, verificationData);
    const { data } = response;
    return data ? new BN(data.factorKey, "hex") : undefined;
  }

  // verify the mfa code and return the remote client setyp params
  async verifyRemoteSetup(factorPub: string, code: string): Promise<Omit<IRemoteClientState, "tssShareIndex">> {
    const verificationData = {
      address: factorPub,
      code,
      web3authNetwork: this.web3authNetwork,
      metadataUrl: this.metadataUrl,
    };

    const response = await post<{ data?: Record<string, string> }>(`${this.backendUrl}/api/v3/verify_remote`, verificationData);
    const { data } = response;

    return {
      remoteClientUrl: this.backendUrl,
      remoteFactorPub: data.factorPub,
      metadataShare: data.metadataShare,
      remoteClientToken: data.signature,
    };
  }
}
