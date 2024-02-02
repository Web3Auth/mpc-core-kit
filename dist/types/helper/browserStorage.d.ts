import BN from "bn.js";
import { IAsyncStorage, ICoreKit, IStorage, SupportedStorageType } from "../interfaces";
export declare class MemoryStorage implements IStorage {
    private _store;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
}
export declare class BrowserStorage {
    private static instance;
    storage: IStorage;
    private _storeKey;
    private constructor();
    static getInstance(key: string, storageKey?: SupportedStorageType): BrowserStorage;
    toJSON(): string;
    resetStore(): Record<string, unknown>;
    getStore(): Record<string, unknown>;
    get<T>(key: string): T;
    set<T>(key: string, value: T): void;
    remove(key: string): void;
}
export declare class AsyncStorage {
    private static instance;
    storage: IAsyncStorage;
    private _storeKey;
    private constructor();
    static getInstance(key: string, storageKey: IAsyncStorage): AsyncStorage;
    toJSON(): Promise<string>;
    resetStore(): Promise<Record<string, unknown>>;
    getStore(): Promise<Record<string, unknown>>;
    get<T>(key: string): Promise<T>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
}
export declare function asyncStoreFactor(factorKey: BN, mpcCoreKit: ICoreKit, storageKey: IAsyncStorage): Promise<void>;
export declare function asyncGetFactor(mpcCoreKit: ICoreKit, storageKey: IAsyncStorage): Promise<string | undefined>;
export declare function storeWebBrowserFactor(factorKey: BN, mpcCoreKit: ICoreKit, storageKey?: SupportedStorageType): Promise<void>;
export declare function getWebBrowserFactor(mpcCoreKit: ICoreKit, storageKey?: SupportedStorageType): Promise<string | undefined>;
