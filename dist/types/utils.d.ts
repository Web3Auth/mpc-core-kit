/// <reference types="node" />
import { Point, Point as TkeyPoint } from "@tkey-mpc/common-types";
import ThresholdKey from "@tkey-mpc/core";
import BN from "bn.js";
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
export declare function storageAvailable(type: string): boolean;
/**
 * Parses a JWT Token, without verifying the signature.
 * @param token - JWT Token
 * @returns Extracted JSON payload from the token
 */
export declare function parseToken(token: string): any;
export declare function addFactorAndRefresh(tKey: ThresholdKey, newFactorPub: Point, newFactorTSSIndex: number, factorKeyForExistingTSSShare: BN, signatures: string[]): Promise<void>;
export declare function deleteFactorAndRefresh(tKey: ThresholdKey, factorPubToDelete: Point, factorKeyForExistingTSSShare: BN, signatures: string[]): Promise<void>;
export declare const getHashedPrivateKey: (postboxKey: string, clientId: string) => BN;
/**
 * Converts a elliptic curve scalar represented by a BN to a byte buffer in SEC1
 * format (i.e., padded to maximum length).
 * @param s - The scalar of type BN.
 * @returns The SEC1 encoded representation of the scalar.
 */
export declare function scalarBNToBufferSEC1(s: BN): Buffer;
