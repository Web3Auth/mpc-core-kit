import { KeyType } from "@tkey/common-types";
import { Ed25519Curve, Secp256k1Curve } from "@toruslabs/elliptic-wrapper";
import { fetchLocalConfig } from "@toruslabs/fnd-base";
import { keccak256 } from "@toruslabs/metadata-helpers";
import { Client } from "@toruslabs/tss-client";
import type { WasmLib as DKLSWasmLib } from "@toruslabs/tss-dkls-lib";
import { sign as signFrost } from "@toruslabs/tss-frost-client";
import type { WasmLib as FrostWasmLibEd25519 } from "@toruslabs/tss-frost-lib";
import type { WasmLib as FrostWasmLibBip340 } from "@toruslabs/tss-frost-lib-bip340";
import BN from "bn.js";

import CoreKitError from "../../helper/errors";
import { ISignerContext, Secp256k1PrecomputedClient } from "../../interfaces";
import { deriveShareCoefficients, generateSessionNonce, getSessionId, sampleEndpoints, scalarBNToBufferSEC1 } from "../../utils";
import { ISigner } from "./ISigner";

export class DefaultSignerPlugin implements ISigner {
  private context: ISignerContext;

  private wasmLib: DKLSWasmLib | FrostWasmLibEd25519 | FrostWasmLibBip340;

  constructor(readonly mpcCorekitContext: ISignerContext) {
    this.context = mpcCorekitContext;
  }

  public async signECDSASecp256k1(data: Buffer, hashed: boolean = false, precomputedTssClient?: Secp256k1PrecomputedClient) {
    const executeSign = async (client: Client, serverCoeffs: Record<string, string>, hashedData: Buffer, signatures: string[]) => {
      const { r, s, recoveryParam } = await client.sign(hashedData.toString("base64"), true, "", "keccak256", {
        signatures,
      });
      // skip await cleanup
      client.cleanup({ signatures, server_coeffs: serverCoeffs });
      return { v: recoveryParam, r: scalarBNToBufferSEC1(r), s: scalarBNToBufferSEC1(s) };
    };
    if (!hashed) {
      data = keccak256(data);
    }

    // // Custom Dkls Sign
    // if (this.customDklsSign) {
    //   // PreSetup
    //   const setupSigningParams = await this.context.preSetupSigning();
    //   const result = await this.customDklsSign(setupSigningParams, data);
    //   return result;
    // }

    const isAlreadyPrecomputed = precomputedTssClient?.client && precomputedTssClient?.serverCoeffs;
    const { client, serverCoeffs, signatures } = isAlreadyPrecomputed ? precomputedTssClient : await this.context.precomputeSecp256k1();

    if (!signatures) {
      throw CoreKitError.signaturesNotPresent();
    }

    try {
      return await executeSign(client, serverCoeffs, data, signatures);
    } catch (error) {
      if (!isAlreadyPrecomputed) {
        throw error;
      }
      // Retry with new client if precomputed client failed, this is to handle the case when precomputed session might have expired
      const { client: newClient, serverCoeffs: newServerCoeffs } = await this.context.precomputeSecp256k1({ sessionSignatures: signatures });
      const result = await executeSign(newClient, newServerCoeffs, data, signatures);

      return result;
    }
  }

  public async signFrost(data: Buffer, keyTweak?: BN): Promise<Buffer> {
    const nodeDetails = fetchLocalConfig(this.context.config.web3AuthNetwork, this.context.keyType, this.context.sigType);
    if (!nodeDetails.torusNodeTSSEndpoints) {
      throw CoreKitError.default("could not fetch tss node endpoints");
    }

    // Endpoints must end with backslash, but URLs returned by
    // `fetch-node-details` don't have it.
    const serverEndpoints = nodeDetails.torusNodeTSSEndpoints.map((ep, i) => ({ index: nodeDetails.torusIndexes[i], url: `${ep}/` }));

    // Select endpoints and derive party indices.
    const serverThreshold = Math.floor(serverEndpoints.length / 2) + 1;
    const endpoints = sampleEndpoints(serverEndpoints, serverThreshold);
    const serverXCoords = endpoints.map((x) => x.index);
    const clientXCoord = Math.max(...endpoints.map((ep) => ep.index)) + 1;

    // Derive share coefficients for flat hierarchy.
    const ec = (() => {
      if (this.context.keyType === KeyType.secp256k1) {
        return new Secp256k1Curve();
      } else if (this.context.keyType === KeyType.ed25519) {
        return new Ed25519Curve();
      }
      throw CoreKitError.default(`key type ${this.context.keyType} not supported with FROST signing`);
    })();
    const { serverCoefficients, clientCoefficient } = deriveShareCoefficients(ec, serverXCoords, clientXCoord, this.context.state.tssShareIndex);

    // Get pub key.
    const tssPubKey = this.context.getPubKey();
    const tssPubKeyPoint = ec.keyFromPublic(tssPubKey).getPublic();

    // Get client key share and adjust by coefficient.
    if (this.context.sigType === "ed25519" && this.context.state.accountIndex !== 0) {
      throw CoreKitError.default("Account index not supported for ed25519");
    }

    // Generate session identifier.
    const tssNonce = this.context.getTssNonce();
    const sessionNonce = generateSessionNonce();
    const session = getSessionId(this.context.verifier, this.context.verifierId, this.context.tKey.tssTag, tssNonce, sessionNonce);

    // Run signing protocol.
    const serverURLs = endpoints.map((x) => x.url);
    const pubKeyHex = ec.pointToBuffer(tssPubKeyPoint, Buffer).toString("hex");
    const serverCoefficientsHex = serverCoefficients.map((c) => ec.scalarToBuffer(c, Buffer).toString("hex"));
    const authSignatures = await this.context.getSessionSignatures();

    // if (this.customFrostSign) {
    //   const factorPub = Point.fromSEC1(secp256k1, this.state.remoteClient.remoteFactorPub);
    //   const params: ICustomFrostSignParams = {
    //     sessionId: session,
    //     signatures: await this.getSessionSignatures(),
    //     tssCommits: this.tKey.getTSSCommits().map((commit) => pointToHex(commit)),
    //     factorEnc: this.tKey.getFactorEncs(factorPub),
    //     serverXCoords,
    //     clientXCoord,
    //     serverCoefficients: serverCoefficients.map((sc) => sc.toString("hex")),
    //     clientCoefficient: clientCoefficient.toString("hex"),
    //     tssPubKeyHex: this.getPubKey().toString("hex"),
    //     serverURLs,
    //     curve: this.tkey.tssKeyType,
    //   };
    //   const result = await this.customFrostSign(params, data);
    //   return Buffer.from(result);
    // }

    // compute client share
    const { tssShare } = await this.context.tKey.getTSSShare(this.context.state.factorKey);
    const clientShareAdjusted = tssShare.mul(clientCoefficient).umod(ec.n);
    const clientShareAdjustedHex = ec.scalarToBuffer(clientShareAdjusted, Buffer).toString("hex");
    this.wasmLib = await this.loadTssWasm();
    const signature = await signFrost(
      this.wasmLib as FrostWasmLibEd25519 | FrostWasmLibBip340,
      session,
      authSignatures,
      serverXCoords,
      serverURLs,
      clientXCoord,
      clientShareAdjustedHex,
      pubKeyHex,
      data,
      serverCoefficientsHex,
      keyTweak?.toString("hex")
    );

    return Buffer.from(signature, "hex");
  }

  private async loadTssWasm() {
    if (this.wasmLib) return this.wasmLib;
    if (this.context.config.tssLib) {
      return this.context.config.tssLib.load();
    }
    throw CoreKitError.default("TSS WASM not loaded");
  }
}
