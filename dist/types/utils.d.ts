/// <reference types="node" />
import { FactorEnc, Point as TkeyPoint, PointHex } from "@tkey-mpc/common-types";
import ThresholdKey from "@tkey-mpc/core";
import { StringifiedType } from "@toruslabs/torus.js";
import BN from "bn.js";
import { IRemoteClientState, Web3AuthState } from "./interfaces";
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
/**
 * Refreshes TSS shares. Allows to change number of shares. New user shares are
 * only produced for the target indices.
 * @param tKey - Tkey instance to use.
 * @param factorPubs - Factor pub keys after refresh.
 * @param tssIndices - Target tss indices to generate new shares for.
 * @param factorKeyForExistingTSSShare - Factor key for existing TSS share.
 * @param signatures - Signatures for authentication against RSS servers.
 */
export declare function refreshTssShares(tKey: ThresholdKey, factorPubs: TkeyPoint[], tssIndices: number[], factorKeyForExistingTSSShare: BN, signatures: string[], updateMetadata?: boolean): Promise<void>;
export interface refreshRemoteTssType {
    factorEnc: FactorEnc;
    factorPubs: TkeyPoint[];
    targetIndexes: number[];
    verifierNameVerifierId: string;
    tssTag: string;
    tssCommits: TkeyPoint[];
    tssNonce: number;
    newTSSServerPub: TkeyPoint;
    serverOpts: {
        serverEndpoints: string[];
        serverPubKeys: PointHex[];
        serverThreshold: number;
        selectedServers: number[];
        authSignatures: string[];
    };
}
export interface refreshRemoteTssReturnType {
    tssTag: string;
    tssNonce: number;
    tssPolyCommits: TkeyPoint[];
    factorPubs: TkeyPoint[];
    factorEncs: {
        [factorPubID: string]: FactorEnc;
    };
}
/**
 * Refreshes TSS shares. Allows to change number of shares. New user shares are
 * only produced for the target indices.
 * @param tKey - Tkey instance to use.
 * @param factorPubs - Factor pub keys after refresh.
 * @param tssIndices - Target tss indices to generate new shares for.
 * @param remoteFactorPub - Factor Pub for remote share.
 * @param signatures - Signatures for authentication against RSS servers.
 */
export declare function remoteRefreshTssShares(tKey: ThresholdKey, factorPubs: TkeyPoint[], tssIndices: number[], signatures: string[], remoteClient: IRemoteClientState, updateMetadata?: boolean): Promise<void>;
export declare function addFactorAndRefresh(tKey: ThresholdKey, newFactorPub: TkeyPoint, newFactorTSSIndex: number, factorKeyForExistingTSSShare: BN, signatures: string[], remoteClient?: IRemoteClientState): Promise<void>;
export declare function deleteFactorAndRefresh(tKey: ThresholdKey, factorPubToDelete: TkeyPoint, factorKeyForExistingTSSShare: BN, signatures: string[], remoteClient?: IRemoteClientState): Promise<void>;
export declare const getHashedPrivateKey: (postboxKey: string, clientId: string) => BN;
/**
 * Converts a elliptic curve scalar represented by a BN to a byte buffer in SEC1
 * format (i.e., padded to maximum length).
 * @param s - The scalar of type BN.
 * @returns The SEC1 encoded representation of the scalar.
 */
export declare function scalarBNToBufferSEC1(s: BN): Buffer;
export declare function Web3AuthStateFromJSON(result: StringifiedType): Web3AuthState;
