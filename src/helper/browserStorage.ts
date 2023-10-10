import BN from "bn.js";

import { FIELD_ELEMENT_HEX_LEN } from "../constants";
import { ICoreKit, IStorage, TkeyLocalStoreData } from "../interfaces";
import { storageAvailable } from "../utils";

export class MockStorage implements IStorage {
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

  constructor(storeKey: string, storage: IStorage) {
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

  static getInstance(key: string, storageKey: "session" | "local" | "mock" = "local"): BrowserStorage {
    if (!this.instance) {
      let storage: IStorage | undefined;
      if (storageKey === "local" && storageAvailable("localStorage")) {
        storage = localStorage;
      }
      if (storageKey === "session" && storageAvailable("sessionStorage")) {
        storage = sessionStorage;
      }
      if (storageKey === "mock") {
        storage = new MockStorage();
      }
      if (!storage) {
        throw new Error("No valid storage available");
      }
      this.instance = new this(key, storage);
    }
    return this.instance;
  }

  toJSON(): string {
    const result = this.storage.getItem(this._storeKey);
    if (!result) throw new Error(`storage ${this._storeKey} is null`);
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

export async function storeWebBrowserFactor(factorKey: BN, mpcCoreKit: ICoreKit, storageKey: "local" | "session" = "local"): Promise<void> {
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

export async function getWebBrowserFactor(mpcCoreKit: ICoreKit, storageKey: "local" | "session" = "local"): Promise<string | undefined> {
  const metadata = mpcCoreKit.tKey.getMetadata();
  const currentStorage = BrowserStorage.getInstance("mpc_corekit_store", storageKey);

  const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
  const tKeyLocalStoreString = currentStorage.get<string>(tkeyPubX);
  const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}") as TkeyLocalStoreData;
  return tKeyLocalStore.factorKey;
}
