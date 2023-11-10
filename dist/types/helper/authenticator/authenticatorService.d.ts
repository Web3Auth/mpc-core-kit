import BN from "bn.js";
import { IRemoteClientState, Web3AuthMPCCoreKit } from "../../index";
export declare class AuthenticatorService {
    private backendUrl;
    private coreKitInstance;
    private authenticatorType;
    private factorPub;
    private tssIndex;
    constructor(params: {
        backendUrl: string;
        coreKitInstance: Web3AuthMPCCoreKit;
        authenticatorType?: string;
    });
    getDescriptionsAndUpdate(): {
        key: string;
        description: any;
    };
    generateSecretKey(): string;
    register(privKey: BN, secretKey: string): Promise<{
        success: boolean;
        message?: string;
    }>;
    addAuthenticatorRecovery(address: string, code: string, factorKey: BN): Promise<void>;
    verifyAuthenticatorRecovery(address: string, code: string): Promise<BN | undefined>;
    verifyRemoteSetup(address: string, code: string): Promise<IRemoteClientState & {
        tssShareIndex: string;
    }>;
}
