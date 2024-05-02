import BN from "bn.js";

import { FIELD_ELEMENT_HEX_LEN } from "../constants";
import CoreKitError from "../errors";
import { IAsyncStorage, ICoreKit, IStorage, SupportedStorageType, TkeyLocalStoreData } from "../interfaces";
import { storageAvailable } from "../utils";

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

export class BrowserStorage {
  // eslint-disable-next-line no-use-before-define
  private static instance: BrowserStorage;

  public storage: IStorage;

  private _storeKey: string;

  private constructor(storeKey: string, storage: IStorage) {
    this.storage = storage;
    this._storeKey = storeKey;
    try {
      if (!storage.getItem(storeKey)) {
        this.resetStore();
      }
    } catch (error) {
      // Storage is not available
    }
  }

  static getInstance(key: string, storageKey: SupportedStorageType = "local"): BrowserStorage {
    if (!this.instance) {
      let storage: IStorage | undefined;
      if (storageKey === "local" && storageAvailable("localStorage")) {
        storage = localStorage;
      } else if (storageKey === "session" && storageAvailable("sessionStorage")) {
        storage = sessionStorage;
      } else if (storageKey === "memory") {
        storage = new MemoryStorage();
      } else if (typeof storageKey === "object") {
        storage = storageKey;
      }

      if (!storage) {
        throw CoreKitError.noValidStorageOptionFound();
      }
      this.instance = new this(key, storage);
    }
    return this.instance;
  }

  toJSON(): string {
    const result = this.storage.getItem(this._storeKey);
    if (!result) {
      throw CoreKitError.noDataFoundInStorage(`No data found in storage under key '${this._storeKey}'.`);
    }
    return result;
  }

  resetStore(): Record<string, unknown> {
    const currStore = this.getStore();
    this.storage.setItem(this._storeKey, JSON.stringify({}));
    return currStore;
  }

  getStore(): Record<string, unknown> {
    return JSON.parse(this.storage.getItem(this._storeKey) || "{}");
  }

  get<T>(key: string): T {
    const store = JSON.parse(this.storage.getItem(this._storeKey) || "{}");
    return store[key];
  }

  set<T>(key: string, value: T): void {
    const store = JSON.parse(this.storage.getItem(this._storeKey) || "{}");
    store[key] = value;
    this.storage.setItem(this._storeKey, JSON.stringify(store));
  }

  remove(key: string): void {
    const store = JSON.parse(this.storage.getItem(this._storeKey) || "{}");
    delete store[key];
    this.storage.setItem(this._storeKey, JSON.stringify(store));
  }
}

export class AsyncStorage {
  // eslint-disable-next-line no-use-before-define
  private static instance: AsyncStorage;

  public storage: IAsyncStorage;

  private _storeKey: string;

  private constructor(storeKey: string, storage: IAsyncStorage) {
    this.storage = storage;
    this._storeKey = storeKey;
  }

  static getInstance(key: string, storageKey: IAsyncStorage): AsyncStorage {
    if (!this.instance) {
      const storage: IAsyncStorage = storageKey;
      if (!storage) {
        throw CoreKitError.noValidStorageOptionFound();
      }
    }
    return this.instance;
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

export async function asyncStoreFactor(factorKey: BN, mpcCoreKit: ICoreKit, storageKey: IAsyncStorage): Promise<void> {
  const metadata = mpcCoreKit.tKey.getMetadata();
  const currentStorage = AsyncStorage.getInstance("mpc_corekit_store", storageKey);

  const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
  await currentStorage.set(
    tkeyPubX,
    JSON.stringify({
      factorKey: factorKey.toString("hex").padStart(64, "0"),
    } as TkeyLocalStoreData)
  );
}

export async function asyncGetFactor(mpcCoreKit: ICoreKit, storageKey: IAsyncStorage): Promise<string | undefined> {
  const metadata = mpcCoreKit.tKey.getMetadata();
  const currentStorage = AsyncStorage.getInstance("mpc_corekit_store", storageKey);

  const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
  const tKeyLocalStoreString = await currentStorage.get<string>(tkeyPubX);
  const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}") as TkeyLocalStoreData;
  return tKeyLocalStore.factorKey;
}

export async function storeWebBrowserFactor(factorKey: BN, mpcCoreKit: ICoreKit, storageKey: SupportedStorageType = "local"): Promise<void> {
  const metadata = mpcCoreKit.tKey.getMetadata();
  const currentStorage = BrowserStorage.getInstance("mpc_corekit_store", storageKey);

  const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
  currentStorage.set(
    tkeyPubX,
    JSON.stringify({
      factorKey: factorKey.toString("hex").padStart(64, "0"),
    } as TkeyLocalStoreData)
  );
}

export async function getWebBrowserFactor(mpcCoreKit: ICoreKit, storageKey: SupportedStorageType = "local"): Promise<string | undefined> {
  const metadata = mpcCoreKit.tKey.getMetadata();
  const currentStorage = BrowserStorage.getInstance("mpc_corekit_store", storageKey);

  const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
  const tKeyLocalStoreString = currentStorage.get<string>(tkeyPubX);
  const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}") as TkeyLocalStoreData;
  return tKeyLocalStore.factorKey;
}
