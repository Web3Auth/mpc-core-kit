/// <reference types="node" />
import { BNString, Point as TkeyPoint } from "@tkey-mpc/common-types";
import ThresholdKey from "@tkey-mpc/core";
import { SafeEventEmitterProvider } from "@web3auth/base";
import BN from "bn.js";
import { COREKIT_STATUS, CreateFactorParams, EnableMFAParams, ICoreKit, IdTokenLoginParams, IFactorKey, InitParams, MPCKeyDetails, OauthLoginParams, UserInfo, Web3AuthOptions, Web3AuthState } from "./interfaces";
export declare class Web3AuthMPCCoreKit implements ICoreKit {
    state: Web3AuthState;
    private options;
    private privKeyProvider;
    private torusSp;
    private storageLayer;
    private tkey;
    private sessionManager;
    private currentStorage;
    private nodeDetailManager;
    private _storageBaseKey;
    private enableLogging;
    private ready;
    constructor(options: Web3AuthOptions);
    get tKey(): ThresholdKey;
    get provider(): SafeEventEmitterProvider | null;
    set provider(_: SafeEventEmitterProvider | null);
    get signatures(): string[];
    set signatures(_: string[] | null);
    get metadataKey(): string | null;
    set metadataKey(_: string | null);
    get status(): COREKIT_STATUS;
    get sessionId(): string;
    private get verifier();
    private get verifierId();
    private get isRedirectMode();
    _UNSAFE_recoverTssKey(factorKey: string[]): Promise<string>;
    init(params?: InitParams): Promise<void>;
    loginWithOauth(params: OauthLoginParams): Promise<void>;
    loginWithJWT(idTokenLoginParams: IdTokenLoginParams): Promise<void>;
    handleRedirectResult(): Promise<void>;
    inputFactorKey(factorKey: BN): Promise<void>;
    getCurrentFactorKey(): IFactorKey;
    getTssPublicKey(): TkeyPoint;
    enableMFA(enableMFAParams: EnableMFAParams, recoveryFactor?: boolean): Promise<string>;
    getTssFactorPub: () => string[];
    createFactor(createFactorParams: CreateFactorParams): Promise<string>;
    getPublic: () => Promise<Buffer>;
    sign: (msgHash: Buffer) => Promise<{
        v: number;
        r: Buffer;
        s: Buffer;
    }>;
    localSign: (msgHash: Buffer) => Promise<{
        v: number;
        r: Buffer;
        s: Buffer;
    }>;
    deleteFactor(factorPub: TkeyPoint, factorKey?: BNString): Promise<void>;
    logout(): Promise<void>;
    getUserInfo(): UserInfo;
    getKeyDetails(): MPCKeyDetails;
    commitChanges(): Promise<void>;
    setManualSync(manualSync: boolean): Promise<void>;
    private importTssKey;
    _UNSAFE_exportTssKey(): Promise<string>;
    private getTssNonce;
    private setupTkey;
    private finalizeTkey;
    private checkReady;
    private rehydrateSession;
    private createSession;
    private isMetadataPresent;
    private checkIfFactorKeyValid;
    private getFactorKeyMetadata;
    /**
     * Copies a share and makes it available under a new factor key. If no share
     * exists at the specified share index, a new share is created.
     * @param newFactorTSSIndex - The index of the share to copy.
     * @param newFactorPub - The public key of the new share.
     */
    private copyOrCreateShare;
    private getMetadataShare;
    private deleteMetadataShareBackup;
    private backupMetadataShare;
    private addFactorDescription;
    private setupProvider;
    private updateState;
    private resetState;
    private _getOAuthKey;
    private _getSignatures;
    private getSigningSignatures;
    private isNodejsOrRN;
    private featureRequest;
}
