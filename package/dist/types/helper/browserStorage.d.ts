import { IAsyncStorage, IStorage } from "../interfaces";
export declare class MemoryStorage implements IStorage {
    private _store;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
}
export declare class AsyncStorage {
    storage: IAsyncStorage | IStorage;
    private _storeKey;
    constructor(storeKey: string, storage: IAsyncStorage | IStorage);
    toJSON(): Promise<string>;
    resetStore(): Promise<Record<string, unknown>>;
    getStore(): Promise<Record<string, unknown>>;
    get<T>(key: string): Promise<T>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
}
