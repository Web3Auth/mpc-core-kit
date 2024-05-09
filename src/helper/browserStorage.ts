import { IAsyncStorage, IStorage } from "../interfaces";
import CoreKitError from "./errors";

export class MemoryStorage implements IStorage {
  private _store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this._store[key] || null;
  }

  setItem(key: string, value: string): void {
    this._store[key] = value;
  }

  removeItem(key: string): void {
    delete this._store[key];
  }

  clear(): void {
    this._store = {};
  }
}

export class AsyncStorage {
  public storage: IAsyncStorage | IStorage;

  private _storeKey: string;

  constructor(storeKey: string, storage: IAsyncStorage | IStorage) {
    this.storage = storage;
    this._storeKey = storeKey;
  }

  async toJSON(): Promise<string> {
    const result = await this.storage.getItem(this._storeKey);
    if (!result) {
      throw CoreKitError.noDataFoundInStorage(`No data found in storage under key '${this._storeKey}'.`);
    }
    return result;
  }

  async resetStore(): Promise<Record<string, unknown>> {
    const currStore = await this.getStore();
    await this.storage.setItem(this._storeKey, JSON.stringify({}));
    return currStore;
  }

  async getStore(): Promise<Record<string, unknown>> {
    return JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
  }

  async get<T>(key: string): Promise<T> {
    const store = JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
    return store[key];
  }

  async set<T>(key: string, value: T): Promise<void> {
    const store = JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
    store[key] = value;
    await this.storage.setItem(this._storeKey, JSON.stringify(store));
  }

  async remove(key: string): Promise<void> {
    const store = JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
    delete store[key];
    await this.storage.setItem(this._storeKey, JSON.stringify(store));
  }
}
