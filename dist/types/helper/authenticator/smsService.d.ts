import BN from "bn.js";
import { IRemoteClientState } from "../../interfaces";
import { Web3AuthMPCCoreKit } from "../../mpcCoreKit";
export declare class SmsService {
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
    register(privKey: BN, number: string): Promise<string | undefined>;
    addSmsRecovery(address: string, code: string, factorKey: BN): Promise<void>;
    requestOTP(address: string): Promise<string | undefined>;
    verifyRecovery(address: string, code: string): Promise<BN | undefined>;
    verifyRemoteSetup(address: string, code: string): Promise<IRemoteClientState & {
        tssShareIndex: string;
    }>;
}
