'use strict';

var _defineProperty = require('@babel/runtime/helpers/defineProperty');
var errors = require('./errors.js');

class MemoryStorage {
  constructor() {
    _defineProperty(this, "_store", {});
  }
  getItem(key) {
    return this._store[key] || null;
  }
  setItem(key, value) {
    this._store[key] = value;
  }
  removeItem(key) {
    delete this._store[key];
  }
  clear() {
    this._store = {};
  }
}
class AsyncStorage {
  constructor(storeKey, storage) {
    _defineProperty(this, "storage", void 0);
    _defineProperty(this, "_storeKey", void 0);
    this.storage = storage;
    this._storeKey = storeKey;
  }
  async toJSON() {
    const result = await this.storage.getItem(this._storeKey);
    if (!result) {
      throw errors.default.noDataFoundInStorage(`No data found in storage under key '${this._storeKey}'.`);
    }
    return result;
  }
  async resetStore() {
    const currStore = await this.getStore();
    await this.storage.setItem(this._storeKey, JSON.stringify({}));
    return currStore;
  }
  async getStore() {
    return JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
  }
  async get(key) {
    const store = JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
    return store[key];
  }
  async set(key, value) {
    const store = JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
    store[key] = value;
    await this.storage.setItem(this._storeKey, JSON.stringify(store));
  }
  async remove(key) {
    const store = JSON.parse((await this.storage.getItem(this._storeKey)) || "{}");
    delete store[key];
    await this.storage.setItem(this._storeKey, JSON.stringify(store));
  }
}

exports.AsyncStorage = AsyncStorage;
exports.MemoryStorage = MemoryStorage;
