import BN from "bn.js";
import { ICoreKit, IStorage } from "../interfaces";
export declare class BrowserStorage {
    private static instance;
    storage: IStorage;
    private _storeKey;
    private constructor();
    static getInstance(key: string, storageKey?: "session" | "local"): BrowserStorage;
    toJSON(): string;
    resetStore(): Record<string, unknown>;
    getStore(): Record<string, unknown>;
    get<T>(key: string): T;
    set<T>(key: string, value: T): void;
    remove(key: string): void;
}
export declare function storeWebBrowserFactor(factorKey: BN, mpcCoreKit: ICoreKit, storageKey?: "local" | "session"): Promise<void>;
export declare function getWebBrowserFactor(mpcCoreKit: ICoreKit, storageKey?: "local" | "session"): Promise<string | undefined>;
