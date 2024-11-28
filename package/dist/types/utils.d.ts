import { Point as TkeyPoint } from "@tkey/common-types";
import { EllipticCurve } from "@toruslabs/elliptic-wrapper";
import BN from "bn.js";
import { eddsa as EDDSA } from "elliptic";
import loglevel from "loglevel";
import { CoreKitSigner, EthereumSigner, IAsyncStorage, IStorage } from "./interfaces";
export declare const ed25519: () => EDDSA;
/**
 * Secure PRNG. Uses `crypto.getRandomValues`, which defers to OS.
 */
export declare function randomBytes(bytesLength?: number): Uint8Array;
export declare function generateEd25519Seed(): Buffer;
export declare const generateFactorKey: () => {
    private: BN;
    pub: TkeyPoint;
};
export declare const generateTSSEndpoints: (tssNodeEndpoints: string[], parties: number, clientIndex: number, nodeIndexes: number[]) => {
    endpoints: string[];
    tssWSEndpoints: string[];
    partyIndexes: number[];
    nodeIndexesReturned: number[];
};
export declare function storageAvailable(storage: IStorage | IAsyncStorage): Promise<boolean>;
/**
 * Parses a JWT Token, without verifying the signature.
 * @param token - JWT Token
 * @returns Extracted JSON payload from the token
 */
export declare function parseToken(token: string): any;
export declare const getHashedPrivateKey: (postboxKey: string, clientId: string) => BN;
/**
 * Converts an elliptic curve scalar represented by a BN to a byte buffer in SEC1
 * format (i.e., padded to maximum length).
 * @param s - The scalar of type BN.
 * @returns The SEC1 encoded representation of the scalar.
 */
export declare function scalarBNToBufferSEC1(s: BN): Buffer;
export interface ServerEndpoint {
    index: number;
    url: string;
}
export declare function sampleEndpoints(endpoints: ServerEndpoint[], n: number): ServerEndpoint[];
export declare function fraction(curve: EllipticCurve, nom: BN, denom: BN): BN;
export declare function lagrangeCoefficient(curve: EllipticCurve, xCoords: BN[], targetCoeff: number, targetX: BN): BN;
export declare function lagrangeCoefficients(curve: EllipticCurve, xCoords: BN[] | number[], targetX: BN | number): BN[];
/**
 * Derive share coefficients for client and servers.
 *
 * @param curve - The curve to be used.
 * @param serverXCoords - The source and target x-coordinates of the selected
 * servers.
 * @param targetClientXCoord - The target x-coordinate of the client.
 * @param sourceClientXCoord - The source x-coordinate of the client in the L1
 * hierarchy.
 * @returns - The share coefficients for the client and the servers.
 */
export declare function deriveShareCoefficients(ec: EllipticCurve, serverXCoords: number[], targetClientXCoord: number, sourceClientXCoord?: number): {
    serverCoefficients: BN[];
    clientCoefficient: BN;
};
export declare function generateSessionNonce(): string;
export declare function getSessionId(verifier: string, verifierId: string, tssTag: string, tssNonce: number, sessionNonce: string): string;
export declare function sigToRSV(sig: Buffer): {
    r: Buffer;
    s: Buffer;
    v: number;
};
export declare function makeEthereumSigner(kit: CoreKitSigner): EthereumSigner;
export declare const log: loglevel.Logger;
