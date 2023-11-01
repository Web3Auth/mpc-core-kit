import { generatePrivate } from "@toruslabs/eccrypto";
import { post } from "@toruslabs/http-helpers";
import { keccak256 } from "@toruslabs/metadata-helpers";
import BN from "bn.js";
import type { ec } from "elliptic";
import base32 from "hi-base32";

import { CURVE } from "../../constants";

export class AuthenticatorService {
  private authenticatorUrl: string;

  // private remoteClient: boolean = false;

  constructor(params: { authenticatorUrl: string }) {
    const { authenticatorUrl } = params;
    this.authenticatorUrl = authenticatorUrl;
    // this.remoteClient = remoteClient || false;
  }

  generateSecretKey(): string {
    const key = generatePrivate().subarray(0, 20);
    return base32.encode(key).toString().replace(/=/g, "");
  }

  async register(privKey: BN, secretKey: string): Promise<{ success: boolean; message?: string }> {
    const privKeyPair: ec.KeyPair = CURVE.keyFromPrivate(privKey.toString(16, 64));
    const pubKey = privKeyPair.getPublic();
    const sig = CURVE.sign(keccak256(Buffer.from(secretKey, "utf8")), Buffer.from(privKey.toString(16, 64), "hex"));

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
      secretKey,
    };

    const resp = await post<{
      success: boolean;
      message: string;
    }>(`${this.authenticatorUrl}/register`, data);

    return resp;
  }

  async addAuthenticatorRecovery(address: string, code: string, factorKey: BN) {
    if (!factorKey) throw new Error("factorKey is not defined");
    if (!address) throw new Error("address is not defined");
    if (!code) throw new Error("code is not defined");

    const data = {
      address,
      code,
      data: {
        // If the verification is complete, we save the factorKey for the user address.
        // This factorKey is used to verify the user in the future on a new device and recover tss share.
        factorKey: factorKey.toString(16, 64),
      },
    };

    await post(`${this.authenticatorUrl}/verify`, data);
  }

  async verifyAuthenticatorRecovery(address: string, code: string): Promise<BN | undefined> {
    const verificationData = {
      address,
      code,
    };

    const response = await post<{ data?: Record<string, string> }>(`${this.authenticatorUrl}/verify`, verificationData);
    const { data } = response;
    return data ? new BN(data.factorKey, "hex") : undefined;
  }

  async verifyAuthenticatorRemoteSetup(address: string, code: string): Promise<BN | undefined> {
    const verificationData = {
      address,
      code,
    };

    const response = await post<{ data?: Record<string, string> }>(`${this.authenticatorUrl}/verify`, verificationData);
    const { data } = response;
    return data ? new BN(data.factorKey, "hex") : undefined;
  }
}
