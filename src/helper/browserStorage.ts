import { TKeyTSS } from "@tkey/tss";
import BN from "bn.js";

import { FIELD_ELEMENT_HEX_LEN } from "../constants";
import { IAsyncStorage, IStorage, TkeyLocalStoreData } from "../interfaces";
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

export class DeviceStorage {
  private tKey: TKeyTSS;

  private currentStorage: AsyncStorage;

  constructor(tkeyInstance: TKeyTSS, currentStorage: AsyncStorage) {
    this.tKey = tkeyInstance;
    this.currentStorage = currentStorage;
  }

  // device factor
  async setDeviceFactor(factorKey: BN, replace = false): Promise<void> {
    if (!replace) {
      const existingFactor = await this.getDeviceFactor();
      if (existingFactor) {
        throw CoreKitError.default("Device factor already exists");
      }
    }

    const metadata = this.tKey.getMetadata();
    const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    await this.currentStorage.set(
      tkeyPubX,
      JSON.stringify({
        factorKey: factorKey.toString("hex").padStart(64, "0"),
      } as TkeyLocalStoreData)
    );
  }

  async getDeviceFactor(): Promise<string | undefined> {
    const metadata = this.tKey.getMetadata();

    const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    const tKeyLocalStoreString = await this.currentStorage.get<string>(tkeyPubX);
    const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}") as TkeyLocalStoreData;
    return tKeyLocalStore.factorKey;
  }
}
