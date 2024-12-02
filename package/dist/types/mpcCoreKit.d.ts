import { BNString, KeyType, Point } from "@tkey/common-types";
import { TKeyTSS, TSSTorusServiceProvider } from "@tkey/tss";
import { Client } from "@toruslabs/tss-client";
import BN from "bn.js";
import { COREKIT_STATUS, CreateFactorParams, EnableMFAParams, ICoreKit, IFactorKey, InitParams, JWTLoginParams, MPCKeyDetails, OAuthLoginParams, Secp256k1PrecomputedClient, UserInfo, Web3AuthOptions, Web3AuthState } from "./interfaces";
export declare class Web3AuthMPCCoreKit implements ICoreKit {
    state: Web3AuthState;
    torusSp: TSSTorusServiceProvider | null;
    private options;
    private storageLayer;
    private tkey;
    private sessionManager?;
    private currentStorage;
    private _storageBaseKey;
    private enableLogging;
    private ready;
    private _tssLib;
    private wasmLib;
    private _keyType;
    private atomicCallStackCounter;
    constructor(options: Web3AuthOptions);
    get tKey(): TKeyTSS;
    get keyType(): KeyType;
    get signatures(): string[];
    get _storageKey(): string;
    get status(): COREKIT_STATUS;
    get sessionId(): string;
    get supportsAccountIndex(): boolean;
    private get verifier();
    private get verifierId();
    private get isRedirectMode();
    private get useClientGeneratedTSSKey();
    _UNSAFE_recoverTssKey(factorKey: string[]): Promise<string>;
    init(params?: InitParams): Promise<void>;
    loginWithOAuth(params: OAuthLoginParams): Promise<void>;
    loginWithJWT(params: JWTLoginParams): Promise<void>;
    handleRedirectResult(): Promise<void>;
    inputFactorKey(factorKey: BN): Promise<void>;
    setTssWalletIndex(accountIndex: number): void;
    getCurrentFactorKey(): IFactorKey;
    enableMFA(enableMFAParams: EnableMFAParams, recoveryFactor?: boolean): Promise<string>;
    getTssFactorPub: () => string[];
    createFactor(createFactorParams: CreateFactorParams): Promise<string>;
    /**
     * Get public key point in SEC1 format.
     */
    getPubKey(): Buffer;
    /**
     * Get public key point.
     */
    getPubKeyPoint(): Point;
    /**
     * Get public key in ed25519 format.
     *
     * Throws an error if keytype is not compatible with ed25519.
     */
    getPubKeyEd25519(): Buffer;
    precompute_secp256k1(): Promise<{
        client: Client;
        serverCoeffs: Record<string, string>;
    }>;
    sign(data: Buffer, hashed?: boolean, secp256k1Precompute?: Secp256k1PrecomputedClient): Promise<Buffer>;
    deleteFactor(factorPub: Point, factorKey?: BNString): Promise<void>;
    logout(): Promise<void>;
    getUserInfo(): UserInfo;
    getKeyDetails(): MPCKeyDetails;
    commitChanges(): Promise<void>;
    setManualSync(manualSync: boolean): Promise<void>;
    setDeviceFactor(factorKey: BN, replace?: boolean): Promise<void>;
    getDeviceFactor(): Promise<string | undefined>;
    /**
     * WARNING: Use with caution. This will export the private signing key.
     *
     * Exports the private key scalar for the current account index.
     *
     * For keytype ed25519, consider using _UNSAFE_exportTssEd25519Seed.
     */
    _UNSAFE_exportTssKey(): Promise<string>;
    /**
     * WARNING: Use with caution. This will export the private signing key.
     *
     * Attempts to export the ed25519 private key seed. Only works if import key
     * flow has been used.
     */
    _UNSAFE_exportTssEd25519Seed(): Promise<Buffer>;
    updateState(newState: Partial<Web3AuthState>): void;
    protected atomicSync<T>(f: () => Promise<T>): Promise<T>;
    private importTssKey;
    private getTssNonce;
    private setupTkey;
    private handleNewUser;
    private handleExistingUser;
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
    private resetState;
    private _getPostBoxKey;
    private _getSignatures;
    private isNodejsOrRN;
    private featureRequest;
    private getAccountNonce;
    private sign_ECDSA_secp256k1;
    private sign_ed25519;
    private loadTssWasm;
}
