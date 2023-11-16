import { TORUS_SAPPHIRE_NETWORK } from '@toruslabs/constants';
import { CHAIN_NAMESPACES, log } from '@web3auth/base';
import { ec } from 'elliptic';
import _defineProperty from '@babel/runtime/helpers/defineProperty';
import { getPubKeyPoint, randomSelection, Point as Point$1, ShareStore, encrypt, SHARE_DELETED } from '@tkey-mpc/common-types';
import { generatePrivate } from '@toruslabs/eccrypto';
import { post } from '@toruslabs/http-helpers';
import TorusUtils, { keccak256 } from '@toruslabs/torus.js';
import BN from 'bn.js';
import { ShareSerializationModule } from '@tkey-mpc/share-serialization';
import _objectSpread from '@babel/runtime/helpers/objectSpread2';
import { keccak256 as keccak256$1 } from '@toruslabs/metadata-helpers';
import base32 from 'hi-base32';
import ThresholdKey, { lagrangeInterpolation, CoreError } from '@tkey-mpc/core';
import { TorusServiceProvider } from '@tkey-mpc/service-provider-torus';
import { TorusStorageLayer } from '@tkey-mpc/storage-layer-torus';
import { UX_MODE, AGGREGATE_VERIFIER, TORUS_METHOD } from '@toruslabs/customauth';
import { NodeDetailManager } from '@toruslabs/fetch-node-details';
import { OpenloginSessionManager } from '@toruslabs/openlogin-session-manager';
import { setupSockets, getDKLSCoeff, Client } from '@toruslabs/tss-client';
import { EthereumSigningProvider } from '@web3auth-mpc/ethereum-provider';
import bowser from 'bowser';

const DEFAULT_CHAIN_CONFIG = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0x5",
  rpcTarget: "https://rpc.ankr.com/eth_goerli",
  displayName: "Goerli Testnet",
  blockExplorer: "https://goerli.etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
  decimals: 18
};
const WEB3AUTH_NETWORK = {
  MAINNET: TORUS_SAPPHIRE_NETWORK.SAPPHIRE_MAINNET,
  DEVNET: TORUS_SAPPHIRE_NETWORK.SAPPHIRE_DEVNET
};
const USER_PATH = {
  NEW: "NewAccount",
  EXISTING: "ExistingAccount",
  REHYDRATE: "RehydrateAccount",
  RECOVER: "RecoverAccount"
};
let FactorKeyTypeShareDescription = /*#__PURE__*/function (FactorKeyTypeShareDescription) {
  FactorKeyTypeShareDescription["HashedShare"] = "hashedShare";
  FactorKeyTypeShareDescription["SecurityQuestions"] = "tssSecurityQuestions";
  FactorKeyTypeShareDescription["DeviceShare"] = "deviceShare";
  FactorKeyTypeShareDescription["SeedPhrase"] = "seedPhrase";
  FactorKeyTypeShareDescription["PasswordShare"] = "passwordShare";
  FactorKeyTypeShareDescription["SocialShare"] = "socialShare";
  FactorKeyTypeShareDescription["Other"] = "Other";
  return FactorKeyTypeShareDescription;
}({});
const DELIMITERS = {
  Delimiter1: "\u001c",
  Delimiter2: "\u0015",
  Delimiter3: "\u0016",
  Delimiter4: "\u0017"
};
const ERRORS = {
  TKEY_SHARES_REQUIRED: "required more shares",
  INVALID_BACKUP_SHARE: "invalid backup share"
};
const SOCIAL_FACTOR_INDEX = 1;

/**
 * Defines the TSS Share Index in a simplified way for better implementation.
 **/
let TssShareType = /*#__PURE__*/function (TssShareType) {
  TssShareType[TssShareType["DEVICE"] = 2] = "DEVICE";
  TssShareType[TssShareType["RECOVERY"] = 3] = "RECOVERY";
  return TssShareType;
}({});
const VALID_SHARE_INDICES = [TssShareType.DEVICE, TssShareType.RECOVERY];
const SCALAR_LEN = 32; // Length of secp256k1 scalar in bytes.
const FIELD_ELEMENT_HEX_LEN = 32 * 2; // Length of secp256k1 field element in hex form.
const CURVE = new ec("secp256k1");
const MAX_FACTORS = 10; // Maximum number of factors that can be added to an account.
const SOCIAL_TKEY_INDEX = 1;

const generateFactorKey = () => {
  const factorKey = new BN(generatePrivate());
  const factorPub = getPubKeyPoint(factorKey);
  return {
    private: factorKey,
    pub: factorPub
  };
};
const generateTSSEndpoints = (tssNodeEndpoints, parties, clientIndex, nodeIndexes) => {
  const endpoints = [];
  const tssWSEndpoints = [];
  const partyIndexes = [];
  const nodeIndexesReturned = [];
  for (let i = 0; i < parties; i++) {
    partyIndexes.push(i);
    if (i === clientIndex) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      endpoints.push(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tssWSEndpoints.push(null);
    } else {
      const targetNodeIndex = nodeIndexes[i] - 1;
      endpoints.push(tssNodeEndpoints[targetNodeIndex]);
      tssWSEndpoints.push(new URL(tssNodeEndpoints[targetNodeIndex]).origin);
      nodeIndexesReturned.push(nodeIndexes[i]);
    }
  }
  return {
    endpoints,
    tssWSEndpoints,
    partyIndexes,
    nodeIndexesReturned
  };
};
function storageAvailable(type) {
  let storage;
  try {
    if (type === "localStorage") storage = window.localStorage;else storage = window.sessionStorage;
    const x = "__storage_test__";
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (error) {
    return false;
  }
}

// TODO think which conversion functions to keep and how to export them.

/**
 * Parses a JWT Token, without verifying the signature.
 * @param token - JWT Token
 * @returns Extracted JSON payload from the token
 */
function parseToken(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace("-", "+").replace("_", "/");
  return JSON.parse(atob(base64 || ""));
}

/**
 * Refreshes TSS shares. Allows to change number of shares. New user shares are
 * only produced for the target indices.
 * @param tKey - Tkey instance to use.
 * @param factorPubs - Factor pub keys after refresh.
 * @param tssIndices - Target tss indices to generate new shares for.
 * @param factorKeyForExistingTSSShare - Factor key for existing TSS share.
 * @param signatures - Signatures for authentication against RSS servers.
 */
async function refreshTssShares(tKey, factorPubs, tssIndices, factorKeyForExistingTSSShare, signatures) {
  let updateMetadata = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;
  const {
    tssShare,
    tssIndex
  } = await tKey.getTSSShare(factorKeyForExistingTSSShare);
  const rssNodeDetails = await tKey._getRssNodeDetails();
  const {
    serverEndpoints,
    serverPubKeys,
    serverThreshold
  } = rssNodeDetails;
  const randomSelectedServers = randomSelection(new Array(rssNodeDetails.serverEndpoints.length).fill(null).map((_, i) => i + 1), Math.ceil(rssNodeDetails.serverEndpoints.length / 2));
  const verifierNameVerifierId = tKey.serviceProvider.getVerifierNameVerifierId();
  await tKey._refreshTSSShares(updateMetadata, tssShare, tssIndex, factorPubs, tssIndices, verifierNameVerifierId, {
    selectedServers: randomSelectedServers,
    serverEndpoints,
    serverPubKeys,
    serverThreshold,
    authSignatures: signatures
  });
}
/**
 * Refreshes TSS shares. Allows to change number of shares. New user shares are
 * only produced for the target indices.
 * @param tKey - Tkey instance to use.
 * @param factorPubs - Factor pub keys after refresh.
 * @param tssIndices - Target tss indices to generate new shares for.
 * @param remoteFactorPub - Factor Pub for remote share.
 * @param signatures - Signatures for authentication against RSS servers.
 */
async function remoteRefreshTssShares(tKey, factorPubs, tssIndices, signatures, remoteClient) {
  let updateMetadata = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;
  // const { tssShare, tssIndex } = await tKey.getTSSShare(factorKeyForExistingTSSShare);

  const rssNodeDetails = await tKey._getRssNodeDetails();
  const {
    serverEndpoints,
    serverPubKeys,
    serverThreshold
  } = rssNodeDetails;
  let finalSelectedServers = randomSelection(new Array(rssNodeDetails.serverEndpoints.length).fill(null).map((_, i) => i + 1), Math.ceil(rssNodeDetails.serverEndpoints.length / 2));
  const verifierNameVerifierId = tKey.serviceProvider.getVerifierNameVerifierId();
  const tssCommits = tKey.metadata.tssPolyCommits[tKey.tssTag];
  const tssNonce = tKey.metadata.tssNonces[tKey.tssTag] || 0;
  const {
    pubKey: newTSSServerPub,
    nodeIndexes
  } = await tKey.serviceProvider.getTSSPubKey(tKey.tssTag, tssNonce + 1);
  // move to pre-refresh
  if ((nodeIndexes === null || nodeIndexes === void 0 ? void 0 : nodeIndexes.length) > 0) {
    finalSelectedServers = nodeIndexes.slice(0, Math.min(serverEndpoints.length, nodeIndexes.length));
  }
  const factorEnc = tKey.getFactorEncs(Point$1.fromCompressedPub(remoteClient.remoteFactorPub));
  const dataRequired = {
    factorEnc,
    factorPubs: factorPubs.map(pub => pub.toJSON()),
    targetIndexes: tssIndices,
    verifierNameVerifierId,
    tssTag: tKey.tssTag,
    tssCommits: tssCommits.map(commit => commit.toJSON()),
    tssNonce,
    newTSSServerPub: newTSSServerPub.toJSON(),
    serverOpts: {
      selectedServers: finalSelectedServers,
      serverEndpoints,
      serverPubKeys,
      serverThreshold,
      authSignatures: signatures
    }
  };
  const result = (await post(`${remoteClient.remoteClientUrl}/api/v3/mpc/refresh_tss`, {
    dataRequired
  }, {
    headers: {
      Authorization: `Bearer ${remoteClient.remoteClientToken}`
    }
  })).data;
  tKey.metadata.addTSSData({
    tssTag: result.tssTag,
    tssNonce: result.tssNonce,
    tssPolyCommits: result.tssPolyCommits.map(commit => Point$1.fromJSON(commit)),
    factorPubs: result.factorPubs.map(pub => Point$1.fromJSON(pub)),
    factorEncs: result.factorEncs
  });
  if (updateMetadata) {
    await tKey._syncShareMetadata();
  }
}
async function addFactorAndRefresh(tKey, newFactorPub, newFactorTSSIndex, factorKeyForExistingTSSShare, signatures, remoteClient) {
  if (!tKey) {
    throw new Error("tkey does not exist, cannot add factor pub");
  }
  if (VALID_SHARE_INDICES.indexOf(newFactorTSSIndex) === -1) {
    throw new Error(`invalid new share index: must be one of ${VALID_SHARE_INDICES}`);
  }
  if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
    throw new Error(`factorPubs for tssTag = "${tKey.tssTag}" does not exist`);
  }
  const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag];
  const updatedFactorPubs = existingFactorPubs.concat([newFactorPub]);
  const existingTSSIndexes = existingFactorPubs.map(fb => tKey.getFactorEncs(fb).tssIndex);
  const updatedTSSIndexes = existingTSSIndexes.concat([newFactorTSSIndex]);
  if (!remoteClient) {
    await refreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, factorKeyForExistingTSSShare, signatures);
  } else {
    await remoteRefreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, signatures, remoteClient);
  }
}
async function deleteFactorAndRefresh(tKey, factorPubToDelete, factorKeyForExistingTSSShare, signatures, remoteClient) {
  if (!tKey) {
    throw new Error("tkey does not exist, cannot add factor pub");
  }
  if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
    throw new Error(`factorPubs for tssTag = "${tKey.tssTag}" does not exist`);
  }
  const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag];
  const factorIndex = existingFactorPubs.findIndex(p => p.x.eq(factorPubToDelete.x));
  if (factorIndex === -1) {
    throw new Error(`factorPub ${factorPubToDelete} does not exist`);
  }
  const updatedFactorPubs = existingFactorPubs.slice();
  updatedFactorPubs.splice(factorIndex, 1);
  const updatedTSSIndexes = updatedFactorPubs.map(fb => tKey.getFactorEncs(fb).tssIndex);
  if (!remoteClient) {
    await refreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, factorKeyForExistingTSSShare, signatures);
  } else {
    await remoteRefreshTssShares(tKey, updatedFactorPubs, updatedTSSIndexes, signatures, remoteClient);
  }
}
const getHashedPrivateKey = (postboxKey, clientId) => {
  const uid = `${postboxKey}_${clientId}`;
  let hashUid = keccak256(Buffer.from(uid, "utf8"));
  hashUid = hashUid.replace("0x", "");
  return new BN(hashUid, "hex");
};

/**
 * Converts a elliptic curve scalar represented by a BN to a byte buffer in SEC1
 * format (i.e., padded to maximum length).
 * @param s - The scalar of type BN.
 * @returns The SEC1 encoded representation of the scalar.
 */
function scalarBNToBufferSEC1(s) {
  return s.toArrayLike(Buffer, "be", SCALAR_LEN);
}
function Web3AuthStateFromJSON(result) {
  if (!result.factorKey) throw new Error("factorKey not found in JSON");
  if (!result.tssShareIndex) throw new Error("tssShareIndex not found in JSON");
  const factorKey = new BN(result.factorKey, "hex");
  const tssPubKey = Buffer.from(result.tssPubKey);
  return {
    factorKey,
    oAuthKey: result.oAuthKey,
    tssShareIndex: parseInt(result.tssShareIndex),
    tssPubKey,
    signatures: result.signatures,
    userInfo: result.userInfo
  };
}

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
class BrowserStorage {
  constructor(storeKey, storage) {
    _defineProperty(this, "storage", void 0);
    _defineProperty(this, "_storeKey", void 0);
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
  static getInstance(key) {
    let storageKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "local";
    if (!this.instance) {
      let storage;
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
        throw new Error("No valid storage available");
      }
      this.instance = new this(key, storage);
    }
    return this.instance;
  }
  toJSON() {
    const result = this.storage.getItem(this._storeKey);
    if (!result) throw new Error(`storage ${this._storeKey} is null`);
    return result;
  }
  resetStore() {
    const currStore = this.getStore();
    this.storage.setItem(this._storeKey, JSON.stringify({}));
    return currStore;
  }
  getStore() {
    return JSON.parse(this.storage.getItem(this._storeKey) || "{}");
  }
  get(key) {
    const store = JSON.parse(this.storage.getItem(this._storeKey) || "{}");
    return store[key];
  }
  set(key, value) {
    const store = JSON.parse(this.storage.getItem(this._storeKey) || "{}");
    store[key] = value;
    this.storage.setItem(this._storeKey, JSON.stringify(store));
  }
  remove(key) {
    const store = JSON.parse(this.storage.getItem(this._storeKey) || "{}");
    delete store[key];
    this.storage.setItem(this._storeKey, JSON.stringify(store));
  }
}
// eslint-disable-next-line no-use-before-define
_defineProperty(BrowserStorage, "instance", void 0);
async function storeWebBrowserFactor(factorKey, mpcCoreKit) {
  let storageKey = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "local";
  const metadata = mpcCoreKit.tKey.getMetadata();
  const currentStorage = BrowserStorage.getInstance("mpc_corekit_store", storageKey);
  const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
  currentStorage.set(tkeyPubX, JSON.stringify({
    factorKey: factorKey.toString("hex").padStart(64, "0")
  }));
}
async function getWebBrowserFactor(mpcCoreKit) {
  let storageKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "local";
  const metadata = mpcCoreKit.tKey.getMetadata();
  const currentStorage = BrowserStorage.getInstance("mpc_corekit_store", storageKey);
  const tkeyPubX = metadata.pubKey.x.toString(16, FIELD_ELEMENT_HEX_LEN);
  const tKeyLocalStoreString = currentStorage.get(tkeyPubX);
  const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}");
  return tKeyLocalStore.factorKey;
}

/**
 * Converts a mnemonic to a BN.
 * @param shareMnemonic - The mnemonic to convert.
 * @returns A BN respective to your mnemonic
 */
function mnemonicToKey(shareMnemonic) {
  const factorKey = ShareSerializationModule.deserializeMnemonic(shareMnemonic);
  return factorKey.toString("hex");
}

/**
 * Converts a BN to a mnemonic.
 * @param shareBN - The BN to convert.
 * @returns A mnemonic respective to your BN
 */
function keyToMnemonic(shareHex) {
  const shareBN = new BN(shareHex, "hex");
  const mnemonic = ShareSerializationModule.serializeMnemonic(shareBN);
  return mnemonic;
}

const ZERO_POINT = CURVE.g.mul(new BN(0));

/**
 * Class `Point` represents an elliptic curve point over curve `CURVE`.
 */
class Point {
  /**
   * Constructs a new Point from an elliptic point.
   * @param p - The elliptic point to be represented.
   */
  constructor(p) {
    _defineProperty(this, "p", void 0);
    this.p = p;
  }
  static fromPrivateKey(privateKey) {
    const ep = CURVE.keyFromPrivate(privateKey.toString("hex")).getPublic();
    return new Point(ep);
  }

  /**
   * Creates a new Point from a TKey Point.
   * @param p - The TKey Point.
   * @returns The Point encoded by `p`.
   */
  static fromTkeyPoint(p) {
    const ep = CURVE.keyFromPublic({
      x: p.x.toString("hex"),
      y: p.y.toString("hex")
    }).getPublic();
    return new Point(ep);
  }

  /**
   * Creates a new Point from an SEC1-encoded byte buffer.
   * @param buf - The SEC1-encoded point.
   * @returns The Point encoded by `buf`.
   */
  static fromBufferSEC1(buf) {
    // "elliptic"@6.5.4 can't decode zero point.
    if (buf.length === 1 && buf[0] === 0) {
      return new Point(ZERO_POINT);
    }
    const p = CURVE.keyFromPublic(buf.toString("hex"), "hex").getPublic();
    return new Point(p);
  }

  /**
   * Converts this point to a TKey Point.
   * @returns A TKey Point representing this point.
   * @throws If this point cannot be represented by a TKey Point. For example,
   * if this point encodes the point at infinity.
   */
  toTkeyPoint() {
    if (this.p.isInfinity()) {
      throw new Error("Point at infinity can't be represented as tkey point.");
    }
    const x = this.p.getX().toString("hex");
    const y = this.p.getY().toString("hex");
    return new Point$1(x, y);
  }

  /**
   * Converts this point to a byte buffer in SEC1 format.
   * @param compressed - Whether to use compressed format.
   * @returns The SEC1-encoded representation of the point.
   */
  toBufferSEC1(compressed) {
    // "elliptic"@6.5.4 can't encode zero point.
    if (this.p.isInfinity()) {
      return Buffer.from("00", "hex");
    }
    return Buffer.from(this.p.encode("hex", compressed), "hex");
  }

  /**
   * Checks for point equality between `this` and `p`.
   * @param p - The point to compare to.
   * @returns True if `this == p`. False otherwise.
   */
  equals(p) {
    return this.p.eq(p.p);
  }
}

class TssSecurityQuestionStore {
  constructor(shareIndex, factorPublicKey, question) {
    _defineProperty(this, "shareIndex", void 0);
    _defineProperty(this, "factorPublicKey", void 0);
    _defineProperty(this, "question", void 0);
    this.shareIndex = shareIndex;
    this.factorPublicKey = factorPublicKey;
    this.question = question;
  }
  static fromJSON(json) {
    const {
      shareIndex,
      factorPublicKey,
      question
    } = json;
    return new TssSecurityQuestionStore(shareIndex, factorPublicKey, question);
  }
  toJSON() {
    return {
      shareIndex: this.shareIndex,
      factorPublicKey: this.factorPublicKey,
      question: this.question
    };
  }
}
class TssSecurityQuestion {
  constructor() {
    _defineProperty(this, "storeDomainName", "tssSecurityQuestion");
  }
  async setSecurityQuestion(params) {
    const {
      mpcCoreKit,
      question,
      answer,
      description
    } = params;
    let {
      shareType
    } = params;
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    if (!question || !answer) {
      throw new Error("question and answer are required");
    }
    const domainKey = `${this.storeDomainName}:${params.mpcCoreKit.tKey.tssTag}`;

    // default using recovery index
    if (!shareType) {
      shareType = TssShareType.RECOVERY;
    } else if (!VALID_SHARE_INDICES.includes(shareType)) {
      throw new Error(`invalid share type: must be one of ${VALID_SHARE_INDICES}`);
    }
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (storeDomain && storeDomain.question) {
      throw new Error("Security question already exists");
    }

    // const pubKey = Point.fromTkeyPoint(mpcCoreKit.tKey.getTSSPub()).toBufferSEC1(true).toString("hex");
    const pubKey = Point.fromTkeyPoint(tkey.getKeyDetails().pubKey).toBufferSEC1(true).toString("hex") + tkey.tssTag;
    let hash = keccak256(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const descriptionFinal = _objectSpread({
      question
    }, description);
    await mpcCoreKit.createFactor({
      factorKey: factorKeyBN,
      shareType,
      shareDescription: FactorKeyTypeShareDescription.SecurityQuestions,
      additionalMetadata: descriptionFinal
    });
    // set store domain
    const tkeyPt = getPubKeyPoint(factorKeyBN);
    const factorPub = Point.fromTkeyPoint(tkeyPt).toBufferSEC1(true).toString("hex");
    const storeData = new TssSecurityQuestionStore(shareType.toString(), factorPub, question);
    tkey.metadata.setGeneralStoreDomain(domainKey, storeData.toJSON());

    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();
    return factorKeyBN.toString("hex").padStart(64, "0");
  }
  async changeSecurityQuestion(params) {
    const {
      mpcCoreKit,
      newQuestion,
      newAnswer,
      answer
    } = params;
    if (!newQuestion || !newAnswer || !answer) {
      throw new Error("question and answer are required");
    }
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    // const pubKey = Point.fromTkeyPoint(mpcCoreKit.tKey.getTSSPub()).toBufferSEC1(true).toString("hex");
    const pubKey = Point.fromTkeyPoint(tkey.getKeyDetails().pubKey).toBufferSEC1(true).toString("hex") + tkey.tssTag;
    const domainKey = `${this.storeDomainName}:${params.mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    const preHash = answer + pubKey;
    let hash = keccak256(Buffer.from(preHash, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const factorKeyPt = Point.fromTkeyPoint(getPubKeyPoint(factorKeyBN));
    if (factorKeyPt.toBufferSEC1(true).toString("hex") !== store.factorPublicKey) {
      throw new Error("Invalid answer");
    }

    // create new factor key
    const prenewHash = newAnswer + pubKey;
    let newHash = keccak256(Buffer.from(prenewHash, "utf8"));
    newHash = newHash.startsWith("0x") ? newHash.slice(2) : newHash;
    const newAnswerBN = new BN(newHash, "hex");
    const newFactorPt = Point.fromTkeyPoint(getPubKeyPoint(newAnswerBN));
    await mpcCoreKit.createFactor({
      factorKey: newAnswerBN,
      shareType: parseInt(store.shareIndex),
      shareDescription: FactorKeyTypeShareDescription.SecurityQuestions
    });

    // update mpcCoreKit state to use new factor key during change password if mpc factor key is security question factor
    if (mpcCoreKit.state.factorKey.eq(factorKeyBN)) {
      await mpcCoreKit.inputFactorKey(newAnswerBN);
    }
    // delete after create factor to prevent last key issue
    // delete old factor key and device share
    await mpcCoreKit.deleteFactor(factorKeyPt.toTkeyPoint(), factorKeyBN);
    store.factorPublicKey = newFactorPt.toBufferSEC1(true).toString("hex");
    store.question = newQuestion;
    tkey.metadata.setGeneralStoreDomain(domainKey, store.toJSON());

    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();
  }

  // Should we check with answer before deleting?
  async deleteSecurityQuestion(mpcCoreKit) {
    let deleteFactorKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const domainKey = `${this.storeDomainName}:${mpcCoreKit.tKey.tssTag}`;
    const tkey = mpcCoreKit.tKey;
    if (deleteFactorKey) {
      const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
      if (!storeDomain || !storeDomain.question) {
        throw new Error("Security question does not exists");
      }
      const store = TssSecurityQuestionStore.fromJSON(storeDomain);
      if (store.factorPublicKey) {
        await mpcCoreKit.deleteFactor(Point$1.fromCompressedPub(store.factorPublicKey));
      }
    }
    tkey.metadata.deleteGeneralStoreDomain(domainKey);
    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();
  }
  async recoverFactor(mpcCoreKit, answer) {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    if (!answer) {
      throw new Error("question and answer are required");
    }
    const tkey = mpcCoreKit.tKey;
    const domainKey = `${this.storeDomainName}:${mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);

    // const pubKey = Point.fromTkeyPoint(mpcCoreKit.tKey.getTSSPub()).toBufferSEC1(true).toString("hex");
    const pubKey = Point.fromTkeyPoint(tkey.getKeyDetails().pubKey).toBufferSEC1(true).toString("hex") + tkey.tssTag;
    let hash = keccak256(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const factorKeyPt = Point.fromTkeyPoint(getPubKeyPoint(factorKeyBN));
    if (factorKeyPt.toBufferSEC1(true).toString("hex") !== store.factorPublicKey) {
      throw new Error("Invalid answer");
    }
    return hash;
  }
  getQuestion(mpcCoreKit) {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const tkey = mpcCoreKit.tKey;
    const domainKey = `${this.storeDomainName}:${mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    return store.question;
  }
}

class AuthenticatorService {
  constructor(params) {
    _defineProperty(this, "backendUrl", void 0);
    _defineProperty(this, "coreKitInstance", void 0);
    _defineProperty(this, "authenticatorType", "authenticator");
    _defineProperty(this, "factorPub", "");
    _defineProperty(this, "tssIndex", void 0);
    const {
      backendUrl
    } = params;
    this.backendUrl = backendUrl;
    this.authenticatorType = params.authenticatorType || "authenticator";
    this.coreKitInstance = params.coreKitInstance;
    // this.remoteClient = remoteClient || false;
  }

  getDescriptionsAndUpdate() {
    const arrayOfDescriptions = Object.entries(this.coreKitInstance.getKeyDetails().shareDescriptions).map(_ref => {
      let [key, value] = _ref;
      const parsedDescription = (value || [])[0] ? JSON.parse(value[0]) : {};
      return {
        key,
        description: parsedDescription
      };
    });
    const shareDescriptionsMobile = arrayOfDescriptions.find(_ref2 => {
      let {
        description
      } = _ref2;
      return description.authenticator === this.authenticatorType;
    });
    log.info("shareDescriptionsMobile", shareDescriptionsMobile);
    if (shareDescriptionsMobile) {
      this.factorPub = shareDescriptionsMobile.key;
      this.tssIndex = shareDescriptionsMobile.description.tssShareIndex;
    }
    return shareDescriptionsMobile;
  }
  generateSecretKey() {
    const key = generatePrivate().subarray(0, 20);
    return base32.encode(key).toString().replace(/=/g, "");
  }
  async register(privKey, secretKey) {
    const privKeyPair = CURVE.keyFromPrivate(privKey.toString(16, 64));
    const pubKey = privKeyPair.getPublic();
    const sig = CURVE.sign(keccak256$1(Buffer.from(secretKey, "utf8")), Buffer.from(privKey.toString(16, 64), "hex"));
    const data = {
      pubKey: {
        x: pubKey.getX().toString(16, 64),
        y: pubKey.getY().toString(16, 64)
      },
      sig: {
        r: sig.r.toString(16, 64),
        s: sig.s.toString(16, 64),
        v: new BN(sig.recoveryParam).toString(16, 2)
      },
      secretKey
    };
    const resp = await post(`${this.backendUrl}/api/v3/register`, data);
    return resp;
  }
  async addRecovery(address, code, factorKey) {
    if (!factorKey) throw new Error("factorKey is not defined");
    if (!address) throw new Error("address is not defined");
    if (!code) throw new Error("code is not defined");
    const data = {
      address,
      code,
      data: {
        // If the verification is complete, we save the factorKey for the user address.
        // This factorKey is used to verify the user in the future on a new device and recover tss share.
        factorKey: factorKey.toString(16, 64)
      }
    };
    await post(`${this.backendUrl}/api/v3/verify`, data);
  }
  async verifyRecovery(address, code) {
    const verificationData = {
      address,
      code
    };
    const response = await post(`${this.backendUrl}/api/v3/verify`, verificationData);
    const {
      data
    } = response;
    return data ? new BN(data.factorKey, "hex") : undefined;
  }
  async verifyRemoteSetup(address, code) {
    const verificationData = {
      address,
      code
    };
    const response = await post(`${this.backendUrl}/api/v3/verify_remote`, verificationData);
    const {
      data
    } = response;
    return {
      tssShareIndex: this.tssIndex.toString(),
      remoteClientUrl: this.backendUrl,
      remoteFactorPub: this.factorPub,
      metadataShare: data.metadataShare,
      remoteClientToken: data.signature
    };
  }
}

class SmsService {
  constructor(params) {
    _defineProperty(this, "backendUrl", void 0);
    _defineProperty(this, "coreKitInstance", void 0);
    _defineProperty(this, "authenticatorType", "sms");
    _defineProperty(this, "factorPub", "");
    _defineProperty(this, "tssIndex", void 0);
    const {
      backendUrl
    } = params;
    this.backendUrl = backendUrl;
    this.authenticatorType = params.authenticatorType || "sms";
    this.coreKitInstance = params.coreKitInstance;
    this.getDescriptionsAndUpdate();
  }
  getDescriptionsAndUpdate() {
    const arrayOfDescriptions = Object.entries(this.coreKitInstance.getKeyDetails().shareDescriptions).map(_ref => {
      let [key, value] = _ref;
      const parsedDescription = (value || [])[0] ? JSON.parse(value[0]) : {};
      return {
        key,
        description: parsedDescription
      };
    });
    const shareDescriptionsMobile = arrayOfDescriptions.find(_ref2 => {
      let {
        description
      } = _ref2;
      return description.authenticator === this.authenticatorType;
    });
    log.info("shareDescriptionsMobile", shareDescriptionsMobile);
    if (shareDescriptionsMobile) {
      this.factorPub = shareDescriptionsMobile.key;
      this.tssIndex = shareDescriptionsMobile.description.tssShareIndex;
    }
    return shareDescriptionsMobile;
  }
  async register(privKey, number) {
    const privKeyPair = CURVE.keyFromPrivate(privKey.toString(16, 64));
    const pubKey = privKeyPair.getPublic();
    const sig = CURVE.sign(keccak256$1(Buffer.from(number, "utf8")), Buffer.from(privKey.toString(16, 64), "hex"));
    const data = {
      pubKey: {
        x: pubKey.getX().toString(16, 64),
        y: pubKey.getY().toString(16, 64)
      },
      sig: {
        r: sig.r.toString(16, 64),
        s: sig.s.toString(16, 64),
        v: new BN(sig.recoveryParam).toString(16, 2)
      },
      number
    };
    await post(`${this.backendUrl}/api/v3/register`, data);

    // this is to send sms to the user instantly after registration.
    const startData = {
      address: `${pubKey.getX().toString(16, 64)}${pubKey.getY().toString(16, 64)}`
    };

    // Sends the user sms.
    const resp2 = await post(`${this.backendUrl}/api/v3/start`, startData);
    // if (resp2.status !== 200) throw new Error("Error sending sms");
    return resp2.code;
  }
  async addSmsRecovery(address, code, factorKey) {
    if (!factorKey) throw new Error("factorKey is not defined");
    if (!address) throw new Error("address is not defined");
    const data = {
      address,
      code,
      data: {
        // If the verification is complete, we save the factorKey for the user address.
        // This factorKey is used to verify the user in the future on a new device and recover tss share.
        factorKey: factorKey.toString(16, 64)
      }
    };
    await post(`${this.backendUrl}/api/v3/verify`, data);
  }
  async requestOTP(address) {
    const startData = {
      address
    };
    const resp2 = await post(`${this.backendUrl}/api/v3/start`, startData);
    // eslint-disable-next-line no-console
    console.log(resp2);
    return resp2.code;
  }
  async verifyRecovery(address, code) {
    const verificationData = {
      address,
      code
    };
    const response = await post(`${this.backendUrl}/api/v3/verify`, verificationData);
    const {
      data
    } = response;
    return data ? new BN(data.factorKey, "hex") : undefined;
  }
  async verifyRemoteSetup(address, code) {
    const verificationData = {
      address,
      code
    };
    const response = await post(`${this.backendUrl}/api/v3/verify_remote`, verificationData);
    const {
      data
    } = response;
    return {
      tssShareIndex: this.tssIndex.toString(),
      remoteClientUrl: this.backendUrl,
      remoteFactorPub: this.factorPub,
      metadataShare: data.metadataShare,
      remoteClientToken: data.signature
    };
  }
}

let COREKIT_STATUS = /*#__PURE__*/function (COREKIT_STATUS) {
  COREKIT_STATUS["NOT_INITIALIZED"] = "NOT_INITIALIZED";
  COREKIT_STATUS["INITIALIZED"] = "INITIALIZED";
  COREKIT_STATUS["REQUIRED_SHARE"] = "REQUIRED_SHARE";
  COREKIT_STATUS["LOGGED_IN"] = "LOGGED_IN";
  return COREKIT_STATUS;
}({});

class Web3AuthMPCCoreKit {
  constructor(options) {
    _defineProperty(this, "state", {});
    _defineProperty(this, "options", void 0);
    _defineProperty(this, "privKeyProvider", null);
    _defineProperty(this, "torusSp", null);
    _defineProperty(this, "storageLayer", null);
    _defineProperty(this, "tkey", null);
    _defineProperty(this, "sessionManager", void 0);
    _defineProperty(this, "currentStorage", void 0);
    _defineProperty(this, "nodeDetailManager", void 0);
    _defineProperty(this, "_storageBaseKey", "corekit_store");
    _defineProperty(this, "enableLogging", false);
    _defineProperty(this, "ready", false);
    _defineProperty(this, "getTssFactorPub", () => {
      this.checkReady();
      if (!this.state.factorKey && !this.state.remoteClient) throw new Error("factorKey not present");
      const factorPubsList = this.tKey.metadata.factorPubs[this.tKey.tssTag];
      return factorPubsList.map(factorPub => Point.fromTkeyPoint(factorPub).toBufferSEC1(true).toString("hex"));
    });
    // function for setting up provider
    _defineProperty(this, "getPublic", async () => {
      let {
        tssPubKey
      } = this.state;
      if (tssPubKey.length === FIELD_ELEMENT_HEX_LEN + 1) {
        tssPubKey = tssPubKey.subarray(1);
      }
      return tssPubKey;
    });
    _defineProperty(this, "sign", async msgHash => {
      if (this.state.remoteClient) {
        return this.remoteSign(msgHash);
      }
      return this.localSign(msgHash);
    });
    _defineProperty(this, "localSign", async msgHash => {
      // PreSetup
      let {
        tssShareIndex,
        tssPubKey
      } = this.state;
      const {
        torusNodeTSSEndpoints
      } = await this.nodeDetailManager.getNodeDetails({
        verifier: "test-verifier",
        verifierId: "test@example.com"
      });
      if (!this.state.factorKey) throw new Error("factorKey not present");
      const {
        tssShare
      } = await this.tKey.getTSSShare(this.state.factorKey);
      const tssNonce = this.getTssNonce();
      if (!tssPubKey || !torusNodeTSSEndpoints) {
        throw new Error("tssPubKey or torusNodeTSSEndpoints not available");
      }
      if (tssPubKey.length === FIELD_ELEMENT_HEX_LEN + 1) {
        tssPubKey = tssPubKey.subarray(1);
      }
      const vid = `${this.verifier}${DELIMITERS.Delimiter1}${this.verifierId}`;
      const sessionId = `${vid}${DELIMITERS.Delimiter2}default${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}`;
      const parties = 4;
      const clientIndex = parties - 1;
      // 1. setup
      // generate endpoints for servers
      const {
        nodeIndexes
      } = await this.tKey.serviceProvider.getTSSPubKey(this.tKey.tssTag, this.tKey.metadata.tssNonces[this.tKey.tssTag]);
      const {
        endpoints,
        tssWSEndpoints,
        partyIndexes,
        nodeIndexesReturned: participatingServerDKGIndexes
      } = generateTSSEndpoints(torusNodeTSSEndpoints, parties, clientIndex, nodeIndexes);
      const randomSessionNonce = keccak256$1(Buffer.from(generatePrivate().toString("hex") + Date.now(), "utf8")).toString("hex");
      const tssImportUrl = `${torusNodeTSSEndpoints[0]}/v3/clientWasm`;
      // session is needed for authentication to the web3auth infrastructure holding the factor 1
      const currentSession = `${sessionId}${randomSessionNonce}`;
      let tss;
      if (this.options.uxMode === "nodejs") {
        tss = this.options.tssLib;
      } else {
        tss = await import('@toruslabs/tss-lib');
        await tss.default(tssImportUrl);
      }
      // setup mock shares, sockets and tss wasm files.
      const [sockets] = await Promise.all([setupSockets(tssWSEndpoints, randomSessionNonce)]);
      const dklsCoeff = getDKLSCoeff(true, participatingServerDKGIndexes, tssShareIndex);
      const denormalisedShare = dklsCoeff.mul(tssShare).umod(CURVE.curve.n);
      const share = scalarBNToBufferSEC1(denormalisedShare).toString("base64");
      if (!currentSession) {
        throw new Error(`sessionAuth does not exist ${currentSession}`);
      }
      const signatures = await this.getSigningSignatures(msgHash.toString("hex"));
      if (!signatures) {
        throw new Error(`Signature does not exist ${signatures}`);
      }
      const client = new Client(currentSession, clientIndex, partyIndexes, endpoints, sockets, share, tssPubKey.toString("base64"), true, tssImportUrl);
      const serverCoeffs = {};
      for (let i = 0; i < participatingServerDKGIndexes.length; i++) {
        const serverIndex = participatingServerDKGIndexes[i];
        serverCoeffs[serverIndex] = getDKLSCoeff(false, participatingServerDKGIndexes, tssShareIndex, serverIndex).toString("hex");
      }
      client.precompute(tss, {
        signatures,
        server_coeffs: serverCoeffs
      });
      await client.ready().catch(err => {
        client.cleanup(tss, {
          signatures,
          server_coeffs: serverCoeffs
        });
        throw err;
      });
      let {
        r,
        s,
        recoveryParam
      } = await client.sign(tss, Buffer.from(msgHash).toString("base64"), true, "", "keccak256", {
        signatures
      });
      if (recoveryParam < 27) {
        recoveryParam += 27;
      }
      // skip await cleanup
      client.cleanup(tss, {
        signatures,
        server_coeffs: serverCoeffs
      });
      return {
        v: recoveryParam,
        r: scalarBNToBufferSEC1(r),
        s: scalarBNToBufferSEC1(s)
      };
    });
    // log.info("======================================================");
    // log.info(`WEB3AUTH SDK : ${name}:${version}`);

    // log.info("======================================================");

    if (!options.chainConfig) options.chainConfig = DEFAULT_CHAIN_CONFIG;
    if (options.chainConfig.chainNamespace !== CHAIN_NAMESPACES.EIP155) {
      throw new Error("You must specify a eip155 chain config.");
    }
    if (!options.web3AuthClientId) {
      throw new Error("You must specify a web3auth clientId.");
    }
    if (options.uxMode === "nodejs" && ["local", "session"].includes(options.storageKey.toString())) {
      throw new Error(`nodejs mode do not storage of type : ${options.storageKey}`);
    }
    if (options.uxMode === "nodejs" && !options.tssLib) {
      throw new Error(`nodejs mode requires tssLib`);
    }
    if (options.enableLogging) {
      log.enableAll();
      this.enableLogging = true;
    } else log.setLevel("error");
    if (typeof options.manualSync !== "boolean") options.manualSync = false;
    if (!options.web3AuthNetwork) options.web3AuthNetwork = WEB3AUTH_NETWORK.MAINNET;
    if (!options.storageKey) options.storageKey = "local";
    if (!options.sessionTime) options.sessionTime = 86400;
    if (!options.uxMode) options.uxMode = UX_MODE.REDIRECT;
    if (!options.redirectPathName) options.redirectPathName = "redirect";
    if (!options.baseUrl) options.baseUrl = `${window.location.origin}/serviceworker`;
    if (!options.disableHashedFactorKey) options.disableHashedFactorKey = false;
    if (!options.authorizationUrl) options.authorizationUrl = [];
    if (!options.allowNoAuthorizationForRemoteClient) options.allowNoAuthorizationForRemoteClient = false;
    this.options = options;
    this.currentStorage = BrowserStorage.getInstance(this._storageBaseKey, this.options.storageKey);
    const _sessionId = this.currentStorage.get("sessionId");
    this.sessionManager = new OpenloginSessionManager({
      sessionTime: this.options.sessionTime,
      sessionId: _sessionId
    });
    this.nodeDetailManager = new NodeDetailManager({
      network: this.options.web3AuthNetwork,
      enableLogging: options.enableLogging
    });
  }
  get tKey() {
    if (this.tkey === null) throw new Error("Tkey not initialized");
    return this.tkey;
  }
  get provider() {
    var _this$privKeyProvider;
    return (_this$privKeyProvider = this.privKeyProvider) !== null && _this$privKeyProvider !== void 0 && _this$privKeyProvider.provider ? this.privKeyProvider.provider : null;
  }
  set provider(_) {
    throw new Error("Not implemented");
  }
  get signatures() {
    var _this$state;
    return (_this$state = this.state) !== null && _this$state !== void 0 && _this$state.signatures ? this.state.signatures : [];
  }
  set signatures(_) {
    throw new Error("Not implemented");
  }
  get metadataKey() {
    var _this$state2;
    return (_this$state2 = this.state) !== null && _this$state2 !== void 0 && _this$state2.oAuthKey ? this.state.oAuthKey : null;
  }
  set metadataKey(_) {
    throw new Error("Not implemented");
  }
  get status() {
    try {
      // metadata will be present if tkey is initialized (1 share)
      // if 2 shares are present, then privKey will be present after metadatakey(tkey) reconstruction
      const {
        tkey
      } = this;
      if (!tkey) return COREKIT_STATUS.NOT_INITIALIZED;
      if (!tkey.metadata) return COREKIT_STATUS.INITIALIZED;
      if (!tkey.privKey || !this.state.factorKey && !this.state.remoteClient) return COREKIT_STATUS.REQUIRED_SHARE;
      return COREKIT_STATUS.LOGGED_IN;
    } catch (e) {}
    return COREKIT_STATUS.NOT_INITIALIZED;
  }
  get sessionId() {
    return this.sessionManager.sessionId;
  }
  get verifier() {
    var _this$state$userInfo, _this$state3;
    if ((_this$state$userInfo = this.state.userInfo) !== null && _this$state$userInfo !== void 0 && _this$state$userInfo.aggregateVerifier) {
      return this.state.userInfo.aggregateVerifier;
    }
    return (_this$state3 = this.state) !== null && _this$state3 !== void 0 && (_this$state3 = _this$state3.userInfo) !== null && _this$state3 !== void 0 && _this$state3.verifier ? this.state.userInfo.verifier : "";
  }
  get verifierId() {
    var _this$state4;
    return (_this$state4 = this.state) !== null && _this$state4 !== void 0 && (_this$state4 = _this$state4.userInfo) !== null && _this$state4 !== void 0 && _this$state4.verifierId ? this.state.userInfo.verifierId : "";
  }
  get isRedirectMode() {
    return this.options.uxMode === UX_MODE.REDIRECT;
  }
  async _UNSAFE_recoverTssKey(factorKey) {
    this.checkReady();
    const factorKeyBN = new BN(factorKey[0], "hex");
    const shareStore0 = await this.getFactorKeyMetadata(factorKeyBN);
    await this.tKey.initialize({
      withShare: shareStore0
    });
    this.tkey.privKey = new BN(factorKey[1], "hex");
    const tssShares = [];
    const tssIndexes = [];
    const tssIndexesBN = [];
    for (let i = 0; i < factorKey.length; i++) {
      const factorKeyBNInput = new BN(factorKey[i], "hex");
      const {
        tssIndex,
        tssShare
      } = await this.tKey.getTSSShare(factorKeyBNInput);
      if (tssIndexes.includes(tssIndex)) {
        await this.init();
        throw new Error("Duplicate TSS Index");
      }
      tssIndexes.push(tssIndex);
      tssIndexesBN.push(new BN(tssIndex));
      tssShares.push(tssShare);
    }
    const finalKey = lagrangeInterpolation(tssShares, tssIndexesBN);
    await this.init();
    return finalKey.toString("hex");
  }
  async init() {
    var _window, _window2;
    let params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
      handleRedirectResult: true
    };
    this.resetState();
    const nodeDetails = await this.nodeDetailManager.getNodeDetails({
      verifier: "test-verifier",
      verifierId: "test@example.com"
    });
    if (!nodeDetails) {
      throw new Error("error getting node details, please try again!");
    }
    this.torusSp = new TorusServiceProvider({
      useTSS: true,
      customAuthArgs: {
        web3AuthClientId: this.options.web3AuthClientId,
        baseUrl: this.options.baseUrl ? this.options.baseUrl : `${window.location.origin}/serviceworker`,
        uxMode: this.options.uxMode === "nodejs" ? UX_MODE.REDIRECT : this.options.uxMode,
        network: this.options.web3AuthNetwork,
        redirectPathName: this.options.redirectPathName,
        locationReplaceOnRedirect: true
      },
      nodeEndpoints: nodeDetails.torusNodeEndpoints,
      nodePubKeys: nodeDetails.torusNodePub.map(i => ({
        x: i.X,
        y: i.Y
      }))
    });
    this.storageLayer = new TorusStorageLayer({
      hostUrl: `${new URL(nodeDetails.torusNodeEndpoints[0]).origin}/metadata`,
      enableLogging: this.enableLogging
    });
    const shareSerializationModule = new ShareSerializationModule();
    this.tkey = new ThresholdKey({
      enableLogging: this.enableLogging,
      serviceProvider: this.torusSp,
      storageLayer: this.storageLayer,
      manualSync: this.options.manualSync,
      modules: {
        shareSerialization: shareSerializationModule
      }
    });
    if (this.isRedirectMode) {
      await this.tKey.serviceProvider.init({
        skipSw: true,
        skipPrefetch: true
      });
    } else if (this.options.uxMode === UX_MODE.POPUP) {
      await this.tKey.serviceProvider.init({});
    }
    this.ready = true;

    // try handle redirect flow if enabled and return(redirect) from oauth login
    if (params.handleRedirectResult && this.options.uxMode === UX_MODE.REDIRECT && ((_window = window) !== null && _window !== void 0 && _window.location.hash.includes("#state") || (_window2 = window) !== null && _window2 !== void 0 && _window2.location.hash.includes("#access_token"))) {
      await this.handleRedirectResult();

      // if not redirect flow try to rehydrate session if available
    } else if (this.sessionManager.sessionId) {
      await this.rehydrateSession();
      if (this.state.factorKey || this.state.remoteClient) await this.setupProvider();
    }
    // if not redirect flow or session rehydration, ask for factor key to login
  }

  async loginWithOauth(params, importTssKey) {
    this.checkReady();
    const tkeyServiceProvider = this.tKey.serviceProvider;
    try {
      // oAuth login.
      const verifierParams = params;
      const aggregateParams = params;
      if (verifierParams.subVerifierDetails) {
        // single verifier login.
        const loginResponse = await tkeyServiceProvider.triggerLogin(params.subVerifierDetails);
        if (this.isRedirectMode) return;
        this.updateState({
          oAuthKey: this._getOAuthKey(loginResponse),
          userInfo: loginResponse.userInfo,
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData)
        });
      } else if (aggregateParams.subVerifierDetailsArray) {
        const loginResponse = await tkeyServiceProvider.triggerAggregateLogin({
          aggregateVerifierType: aggregateParams.aggregateVerifierType || AGGREGATE_VERIFIER.SINGLE_VERIFIER_ID,
          verifierIdentifier: aggregateParams.aggregateVerifierIdentifier,
          subVerifierDetailsArray: aggregateParams.subVerifierDetailsArray
        });
        if (this.isRedirectMode) return;
        this.updateState({
          oAuthKey: this._getOAuthKey(loginResponse),
          userInfo: loginResponse.userInfo[0],
          signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData)
        });
      }
      await this.setupTkey(importTssKey);
    } catch (err) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error(err.message);
    }
  }
  async loginWithJWT(idTokenLoginParams, importTssKey) {
    this.checkReady();
    const {
      verifier,
      verifierId,
      idToken
    } = idTokenLoginParams;
    try {
      // oAuth login.
      let loginResponse;
      if (!idTokenLoginParams.subVerifier) {
        // single verifier login.
        loginResponse = await this.tKey.serviceProvider.customAuthInstance.getTorusKey(verifier, verifierId, {
          verifier_id: verifierId
        }, idToken, _objectSpread(_objectSpread({}, idTokenLoginParams.extraVerifierParams), idTokenLoginParams.additionalParams));
        this.tKey.serviceProvider.verifierType = "normal";
      } else {
        // aggregate verifier login
        loginResponse = await this.tKey.serviceProvider.customAuthInstance.getAggregateTorusKey(verifier, verifierId, [{
          verifier: idTokenLoginParams.subVerifier,
          idToken,
          extraVerifierParams: idTokenLoginParams.extraVerifierParams
        }]);
        this.tKey.serviceProvider.verifierType = "aggregate";
      }
      const oAuthShare = this._getOAuthKey(loginResponse);
      this.tKey.serviceProvider.postboxKey = new BN(oAuthShare, "hex");
      this.tKey.serviceProvider.verifierName = verifier;
      this.tKey.serviceProvider.verifierId = verifierId;
      this.updateState({
        oAuthKey: oAuthShare,
        userInfo: _objectSpread(_objectSpread({}, parseToken(idToken)), {}, {
          verifier,
          verifierId
        }),
        signatures: this._getSignatures(loginResponse.sessionData.sessionTokenData)
      });
      await this.setupTkey(importTssKey);
    } catch (err) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error(err.message);
    }
  }
  async handleRedirectResult() {
    this.checkReady();
    try {
      const result = await this.torusSp.customAuthInstance.getRedirectResult();
      if (result.method === TORUS_METHOD.TRIGGER_LOGIN) {
        const data = result.result;
        if (!data) throw new Error("Invalid login params passed");
        this.updateState({
          oAuthKey: this._getOAuthKey(data),
          userInfo: data.userInfo,
          signatures: this._getSignatures(data.sessionData.sessionTokenData)
        });
        this.torusSp.verifierType = "normal";
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.verifier;
      } else if (result.method === TORUS_METHOD.TRIGGER_AGGREGATE_LOGIN) {
        const data = result.result;
        if (!data) throw new Error("Invalid login params passed");
        this.updateState({
          oAuthKey: this._getOAuthKey(data),
          userInfo: data.userInfo[0],
          signatures: this._getSignatures(data.sessionData.sessionTokenData)
        });
        this.torusSp.verifierType = "aggregate";
        const userInfo = this.getUserInfo();
        this.torusSp.verifierName = userInfo.aggregateVerifier;
      } else {
        throw new Error("Unsupported method type");
      }
      const userInfo = this.getUserInfo();
      if (!this.state.oAuthKey) throw new Error("oAuthKey not present");
      this.torusSp.postboxKey = new BN(this.state.oAuthKey, "hex");
      this.torusSp.verifierId = userInfo.verifierId;
      await this.setupTkey();
    } catch (error) {
      log.error("error while handling redirect result", error);
      throw new Error(error.message);
    }
  }
  async inputFactorKey(factorKey) {
    this.checkReady();
    if (this.state.remoteClient) throw new Error("remoteClient is present, inputFactorKey are not allowed");
    try {
      // input tkey device share when required share > 0 ( or not reconstructed )
      // assumption tkey shares will not changed
      if (!this.tKey.privKey) {
        const factorKeyMetadata = await this.getFactorKeyMetadata(factorKey);
        await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
      }

      // Finalize initialization.
      await this.tKey.reconstructKey();
      await this.finalizeTkey(factorKey);
    } catch (err) {
      log.error("login error", err);
      if (err instanceof CoreError) {
        if (err.code === 1302) throw new Error(ERRORS.TKEY_SHARES_REQUIRED);
      }
      throw new Error(err.message);
    }
  }
  getCurrentFactorKey() {
    this.checkReady();
    if (!this.state.factorKey && !this.state.remoteClient) throw new Error("factorKey not present");
    if (!this.state.tssShareIndex) throw new Error("TSS Share Type (Index) not present");
    try {
      return {
        factorKey: this.state.factorKey,
        shareType: this.state.tssShareIndex
      };
    } catch (err) {
      log.error("state error", err);
      throw new Error(err.message);
    }
  }
  getTssPublicKey() {
    this.checkReady();
    return this.tKey.getTSSPub();
  }
  async enableMFA(enableMFAParams) {
    let recoveryFactor = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    this.checkReady();
    const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.web3AuthClientId);
    if (!(await this.checkIfFactorKeyValid(hashedFactorKey))) {
      if (this.tKey._localMetadataTransitions[0].length) throw new Error("CommitChanges are required before enabling MFA");
      throw new Error("MFA already enabled");
    }
    let browserData;
    if (this.options.uxMode === "nodejs") {
      browserData = {
        browserName: "Node Env",
        browserVersion: "",
        deviceName: "nodejs"
      };
    } else {
      const browserInfo = bowser.parse(navigator.userAgent);
      const browserName = `${browserInfo.browser.name}`;
      browserData = {
        browserName,
        browserVersion: browserInfo.browser.version,
        deviceName: browserInfo.os.name
      };
    }
    const deviceFactorKey = new BN(await this.createFactor({
      shareType: TssShareType.DEVICE,
      additionalMetadata: browserData
    }), "hex");
    storeWebBrowserFactor(deviceFactorKey, this);
    await this.inputFactorKey(new BN(deviceFactorKey, "hex"));
    const hashedFactorPub = getPubKeyPoint(hashedFactorKey);
    await this.deleteFactor(hashedFactorPub, hashedFactorKey);
    await this.deleteMetadataShareBackup(hashedFactorKey);

    // only recovery factor = true
    if (recoveryFactor) {
      const backupFactorKey = await this.createFactor(_objectSpread({
        shareType: TssShareType.RECOVERY
      }, enableMFAParams));
      return backupFactorKey;
    }
    // update to undefined for next major release
    return "";
  }
  async createFactor(createFactorParams) {
    this.checkReady();
    let {
      shareType,
      factorKey,
      shareDescription,
      additionalMetadata
    } = createFactorParams;
    if (!VALID_SHARE_INDICES.includes(shareType)) {
      throw new Error(`invalid share type: must be one of ${VALID_SHARE_INDICES}`);
    }
    if (!factorKey) {
      factorKey = generateFactorKey().private;
    }
    if (!shareDescription) {
      shareDescription = FactorKeyTypeShareDescription.Other;
    }
    if (!additionalMetadata) {
      additionalMetadata = {};
    }
    const factorPub = getPubKeyPoint(factorKey);
    if (this.getTssFactorPub().includes(Point.fromTkeyPoint(factorPub).toBufferSEC1(true).toString("hex"))) {
      throw new Error("Factor already exists");
    }
    try {
      await this.copyOrCreateShare(shareType, factorPub);
      await this.backupMetadataShare(factorKey);
      await this.addFactorDescription(factorKey, shareDescription, additionalMetadata);
      if (!this.tKey.manualSync) await this.tKey._syncShareMetadata();
      return scalarBNToBufferSEC1(factorKey).toString("hex");
    } catch (error) {
      log.error("error creating factor", error);
      throw error;
    }
  }
  async deleteFactor(factorPub, factorKey) {
    if (!this.state.factorKey && !this.state.remoteClient) throw new Error("Factor key not present");
    if (!this.tKey.metadata.factorPubs) throw new Error("Factor pubs not present");
    const remainingFactors = this.tKey.metadata.factorPubs[this.tKey.tssTag].length || 0;
    if (remainingFactors <= 1) throw new Error("Cannot delete last factor");
    const fpp = Point.fromTkeyPoint(factorPub);
    const signatures = await this.getSigningSignatures("delete factor");
    if (this.state.remoteClient) {
      const remoteStateFpp = this.state.remoteClient.remoteFactorPub;
      if (fpp.equals(Point.fromTkeyPoint(getPubKeyPoint(new BN(remoteStateFpp, "hex"))))) {
        throw new Error("Cannot delete current active factor");
      }
      await deleteFactorAndRefresh(this.tKey, factorPub, new BN(0),
      // not used in remoteClient
      signatures, this.state.remoteClient);
    } else {
      const stateFpp = Point.fromTkeyPoint(getPubKeyPoint(this.state.factorKey));
      if (fpp.equals(stateFpp)) {
        throw new Error("Cannot delete current active factor");
      }
      await deleteFactorAndRefresh(this.tKey, factorPub, this.state.factorKey, signatures);
    }
    const factorPubHex = fpp.toBufferSEC1(true).toString("hex");
    const allDesc = this.tKey.metadata.getShareDescription();
    const keyDesc = allDesc[factorPubHex];
    if (keyDesc) {
      keyDesc.forEach(async desc => {
        var _this$tKey;
        await ((_this$tKey = this.tKey) === null || _this$tKey === void 0 ? void 0 : _this$tKey.deleteShareDescription(factorPubHex, desc));
      });
    }

    // delete factorKey share metadata if factorkey is provided
    if (factorKey) {
      const factorKeyBN = new BN(factorKey, "hex");
      const derivedFactorPub = Point.fromTkeyPoint(getPubKeyPoint(factorKeyBN));
      // only delete if factorPub matches
      if (derivedFactorPub.equals(fpp)) {
        await this.deleteMetadataShareBackup(factorKeyBN);
      }
    }
    if (!this.tKey.manualSync) await this.tKey._syncShareMetadata();
  }
  async logout() {
    if (this.sessionManager.sessionId) {
      // throw new Error("User is not logged in.");
      await this.sessionManager.invalidateSession();
    }
    this.currentStorage.set("sessionId", "");
    this.resetState();
    await this.init({
      handleRedirectResult: false
    });
  }
  getUserInfo() {
    if (!this.state.userInfo) {
      throw new Error("user is not logged in.");
    }
    return this.state.userInfo;
  }
  getKeyDetails() {
    this.checkReady();
    const tkeyDetails = this.tKey.getKeyDetails();
    const tssPubKey = this.state.tssPubKey ? this.tKey.getTSSPub() : undefined;
    const factors = this.tKey.metadata.factorPubs ? this.tKey.metadata.factorPubs[this.tKey.tssTag] : [];
    const keyDetails = {
      // use tkey's for now
      requiredFactors: tkeyDetails.requiredShares,
      threshold: tkeyDetails.threshold,
      totalFactors: factors.length + 1,
      shareDescriptions: this.tKey.getMetadata().getShareDescription(),
      metadataPubKey: tkeyDetails.pubKey,
      tssPubKey
    };
    return keyDetails;
  }
  async commitChanges() {
    this.checkReady();
    if (!this.state.factorKey && !this.state.remoteClient) throw new Error("factorKey not present");
    try {
      // in case for manualsync = true, _syncShareMetadata will not call syncLocalMetadataTransitions()
      // it will not create a new LocalMetadataTransition
      // manual call syncLocalMetadataTransitions() required to sync local transitions to storage
      await this.tKey._syncShareMetadata();
      await this.tKey.syncLocalMetadataTransitions();
    } catch (error) {
      log.error("sync metadata error", error);
      throw error;
    }
  }
  async setManualSync(manualSync) {
    this.checkReady();
    // sync local transistion to storage before allow changes
    await this.tKey.syncLocalMetadataTransitions();
    this.options.manualSync = manualSync;
    this.tKey.manualSync = manualSync;
  }
  async setupRemoteClient(params) {
    const {
      remoteClientUrl,
      remoteFactorPub,
      metadataShare,
      remoteClientToken,
      tssShareIndex
    } = params;
    const remoteClient = {
      remoteClientUrl: remoteClientUrl.at(-1) === "/" ? remoteClientUrl.slice(0, -1) : remoteClientUrl,
      remoteFactorPub,
      metadataShare,
      remoteClientToken
    };
    const sharestore = ShareStore.fromJSON(JSON.parse(metadataShare));
    this.tkey.inputShareStoreSafe(sharestore);
    await this.tKey.reconstructKey();

    // setup Tkey
    const tssPubKey = Point.fromTkeyPoint(this.tKey.getTSSPub()).toBufferSEC1(false);
    this.updateState({
      tssShareIndex: parseInt(tssShareIndex),
      tssPubKey,
      remoteClient
    });

    // // Finalize setup.
    // setup provider
    await this.setupProvider();
    await this.createSession();
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  async importTssKey(tssKey, factorPub) {
    let newTSSIndex = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : TssShareType.DEVICE;
    if (!this.state.signatures) throw new Error("signatures not present");
    const tssKeyBN = new BN(tssKey, "hex");
    await this.tKey.importTssKey({
      tag: this.tKey.tssTag,
      importKey: tssKeyBN,
      factorPub,
      newTSSIndex
    }, {
      authSignatures: this.state.signatures
    });
  }
  async _UNSAFE_exportTssKey() {
    if (this.state.remoteClient) throw new Error("export tss key not supported for remote client");
    if (!this.state.factorKey) throw new Error("factorKey not present");
    if (!this.state.signatures) throw new Error("signatures not present");
    const exportTssKey = await this.tKey._UNSAFE_exportTssKey({
      factorKey: this.state.factorKey,
      authSignatures: this.state.signatures,
      selectedServers: []
    });
    return exportTssKey.toString("hex", FIELD_ELEMENT_HEX_LEN);
  }
  getTssNonce() {
    if (!this.tKey.metadata.tssNonces) throw new Error("tssNonce not present");
    const tssNonce = this.tKey.metadata.tssNonces[this.tKey.tssTag];
    return tssNonce;
  }
  async setupTkey(importTssKey) {
    if (this.state.remoteClient) {
      log.warn("remote client is present, setupTkey are skipped");
      return;
    }
    if (!this.state.oAuthKey) {
      throw new Error("user not logged in");
    }
    const existingUser = await this.isMetadataPresent(this.state.oAuthKey);
    if (!existingUser) {
      // Generate or use hash factor and initialize tkey with it.
      let factorKey;
      if (this.options.disableHashedFactorKey) {
        factorKey = generateFactorKey().private;
        // delete previous hashed factorKey if present
        const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.web3AuthClientId);
        await this.deleteMetadataShareBackup(hashedFactorKey);
      } else {
        factorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.web3AuthClientId);
      }
      const deviceTSSIndex = TssShareType.DEVICE;
      const factorPub = getPubKeyPoint(factorKey);
      if (!importTssKey) {
        const deviceTSSShare = new BN(generatePrivate());
        await this.tKey.initialize({
          useTSS: true,
          factorPub,
          deviceTSSShare,
          deviceTSSIndex
        });
      } else {
        await this.tKey.initialize();
        await this.importTssKey(importTssKey, factorPub, deviceTSSIndex);
      }

      // Finalize initialization.
      await this.tKey.reconstructKey();
      await this.finalizeTkey(factorKey);

      // Store factor description.
      await this.backupMetadataShare(factorKey);
      if (this.options.disableHashedFactorKey) {
        await this.addFactorDescription(factorKey, FactorKeyTypeShareDescription.Other);
      } else {
        await this.addFactorDescription(factorKey, FactorKeyTypeShareDescription.HashedShare);
      }
    } else {
      if (importTssKey) throw new Error("Cannot import tss key for existing user");
      await this.tKey.initialize({
        neverInitializeNewKey: true
      });
      const hashedFactorKey = getHashedPrivateKey(this.state.oAuthKey, this.options.web3AuthClientId);
      if ((await this.checkIfFactorKeyValid(hashedFactorKey)) && !this.options.disableHashedFactorKey) {
        // Initialize tkey with existing hashed share if available.
        const factorKeyMetadata = await this.getFactorKeyMetadata(hashedFactorKey);
        await this.tKey.inputShareStoreSafe(factorKeyMetadata, true);
        await this.tKey.reconstructKey();
        await this.finalizeTkey(hashedFactorKey);
      }
    }
  }
  async finalizeTkey(factorKey) {
    // Read tss meta data.
    const {
      tssIndex: tssShareIndex
    } = await this.tKey.getTSSShare(factorKey);
    const tssPubKey = Point.fromTkeyPoint(this.tKey.getTSSPub()).toBufferSEC1(false);
    this.updateState({
      tssShareIndex,
      tssPubKey,
      factorKey
    });

    // Finalize setup.
    if (!this.tKey.manualSync) await this.tKey.syncLocalMetadataTransitions();
    await this.setupProvider();
    await this.createSession();
  }
  checkReady() {
    if (!this.ready) {
      throw Error("MPC Core Kit not initialized, call init first!");
    }
  }
  async rehydrateSession() {
    try {
      this.checkReady();
      if (!this.sessionManager.sessionId) return {};
      const result = await this.sessionManager.authorizeSession();
      if (!result.factorKey && !result.remoteClient) throw new Error("factorKey not present");
      let metadataShare;
      if (result.factorKey) {
        const factorKey = new BN(result.factorKey, "hex");
        if (!factorKey) {
          throw new Error("Invalid factor key");
        }
        metadataShare = await this.getFactorKeyMetadata(factorKey);
      } else {
        metadataShare = ShareStore.fromJSON(JSON.parse(result.remoteClient.metadataShare));
      }
      this.torusSp.postboxKey = new BN(result.oAuthKey, "hex");
      this.torusSp.verifierName = result.userInfo.aggregateVerifier || result.userInfo.verifier;
      this.torusSp.verifierId = result.userInfo.verifierId;
      this.torusSp.verifierType = result.userInfo.aggregateVerifier ? "aggregate" : "normal";
      await this.tKey.initialize({
        neverInitializeNewKey: true
      });
      await this.tKey.inputShareStoreSafe(metadataShare, true);
      await this.tKey.reconstructKey();
      this.updateState({
        factorKey: new BN(result.factorKey, "hex"),
        oAuthKey: result.oAuthKey,
        tssShareIndex: result.tssShareIndex,
        tssPubKey: Buffer.from(result.tssPubKey.padStart(FIELD_ELEMENT_HEX_LEN, "0"), "hex"),
        signatures: result.signatures,
        userInfo: result.userInfo,
        remoteClient: result.remoteClient
      });
    } catch (err) {
      log.error("error trying to authorize session", err);
    }
  }
  async createSession() {
    if (this.options.sessionTime === 0) {
      log.info("sessionTime is 0, not creating session");
      return;
    }
    try {
      const sessionId = OpenloginSessionManager.generateRandomSessionKey();
      this.sessionManager.sessionId = sessionId;
      const {
        oAuthKey,
        factorKey,
        userInfo,
        tssShareIndex,
        tssPubKey,
        remoteClient
      } = this.state;
      if (!this.state.factorKey && !this.state.remoteClient) throw new Error("factorKey not present");
      if (!this.state.remoteClient) {
        const {
          tssShare
        } = await this.tKey.getTSSShare(this.state.factorKey);
        if (!oAuthKey || !factorKey || !tssShare || !tssPubKey || !userInfo) {
          throw new Error("User not logged in");
        }
      }
      const payload = {
        oAuthKey,
        factorKey: factorKey === null || factorKey === void 0 ? void 0 : factorKey.toString("hex"),
        tssShareIndex: tssShareIndex,
        tssPubKey: Buffer.from(tssPubKey).toString("hex"),
        signatures: this.signatures,
        userInfo,
        remoteClient
      };
      await this.sessionManager.createSession(payload);
      this.currentStorage.set("sessionId", sessionId);
    } catch (err) {
      log.error("error creating session", err);
    }
  }
  async isMetadataPresent(privateKey) {
    var _this$tKey2;
    const privateKeyBN = new BN(privateKey, "hex");
    const metadata = await ((_this$tKey2 = this.tKey) === null || _this$tKey2 === void 0 ? void 0 : _this$tKey2.storageLayer.getMetadata({
      privKey: privateKeyBN
    }));
    if (metadata && Object.keys(metadata).length > 0 && metadata.message !== "KEY_NOT_FOUND") {
      return true;
    }
    return false;
  }
  async checkIfFactorKeyValid(factorKey) {
    var _this$tKey3;
    this.checkReady();
    const factorKeyMetadata = await ((_this$tKey3 = this.tKey) === null || _this$tKey3 === void 0 ? void 0 : _this$tKey3.storageLayer.getMetadata({
      privKey: factorKey
    }));
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND" || factorKeyMetadata.message === "SHARE_DELETED") {
      return false;
    }
    log.info("factorKeyMetadata", factorKeyMetadata);
    return true;
  }
  async getFactorKeyMetadata(factorKey) {
    var _this$tKey4;
    this.checkReady();
    const factorKeyMetadata = await ((_this$tKey4 = this.tKey) === null || _this$tKey4 === void 0 ? void 0 : _this$tKey4.storageLayer.getMetadata({
      privKey: factorKey
    }));
    if (!factorKeyMetadata || factorKeyMetadata.message === "KEY_NOT_FOUND") {
      throw new Error("no metadata for your factor key, reset your account");
    }
    return ShareStore.fromJSON(factorKeyMetadata);
  }

  /**
   * Copies a share and makes it available under a new factor key. If no share
   * exists at the specified share index, a new share is created.
   * @param newFactorTSSIndex - The index of the share to copy.
   * @param newFactorPub - The public key of the new share.
   */
  async copyOrCreateShare(newFactorTSSIndex, newFactorPub) {
    this.checkReady();
    if (!this.tKey.metadata.factorPubs || !Array.isArray(this.tKey.metadata.factorPubs[this.tKey.tssTag])) {
      throw new Error("factorPubs does not exist, failed in copy factor pub");
    }
    if (!this.tKey.metadata.factorEncs || typeof this.tKey.metadata.factorEncs[this.tKey.tssTag] !== "object") {
      throw new Error("factorEncs does not exist, failed in copy factor pub");
    }
    if (!this.state.factorKey && !this.state.remoteClient) {
      throw new Error("factorKey not present");
    }
    if (VALID_SHARE_INDICES.indexOf(newFactorTSSIndex) === -1) {
      throw new Error(`invalid new share index: must be one of ${VALID_SHARE_INDICES}`);
    }
    if (this.tKey.metadata.factorPubs[this.tKey.tssTag].length >= MAX_FACTORS) {
      throw new Error("Maximum number of factors reached");
    }
    const signatures = await this.getSigningSignatures("create factor");
    if (this.state.tssShareIndex !== newFactorTSSIndex) {
      // Generate new share.
      if (!this.state.remoteClient) {
        await addFactorAndRefresh(this.tKey, newFactorPub, newFactorTSSIndex, this.state.factorKey, signatures);
      } else {
        await addFactorAndRefresh(this.tKey, newFactorPub, newFactorTSSIndex, this.state.factorKey, signatures, this.state.remoteClient);
      }
      return;
    }
    // TODO : fix this
    let userEnc;
    if (this.state.remoteClient) {
      const remoteFactorPub = Point$1.fromCompressedPub(this.state.remoteClient.remoteFactorPub);
      const factorEnc = this.tkey.getFactorEncs(remoteFactorPub);
      const tssCommits = this.tkey.getTSSCommits();
      const dataRequired = {
        factorEnc,
        tssCommits,
        factorPub: newFactorPub
      };
      userEnc = (await post(`${this.state.remoteClient.remoteClientUrl}/api/v3/mpc/copy_tss_share`, {
        dataRequired
      }, {
        headers: {
          Authorization: `Bearer ${this.state.remoteClient.remoteClientToken}`
        }
      })).data;
    } else {
      const {
        tssShare
      } = await this.tKey.getTSSShare(this.state.factorKey);
      userEnc = await encrypt(Point.fromTkeyPoint(newFactorPub).toBufferSEC1(false), scalarBNToBufferSEC1(tssShare));
    }
    const updatedFactorPubs = this.tKey.metadata.factorPubs[this.tKey.tssTag].concat([newFactorPub]);
    const factorEncs = JSON.parse(JSON.stringify(this.tKey.metadata.factorEncs[this.tKey.tssTag]));
    const factorPubID = newFactorPub.x.toString(16, FIELD_ELEMENT_HEX_LEN);
    factorEncs[factorPubID] = {
      tssIndex: this.state.tssShareIndex,
      type: "direct",
      userEnc,
      serverEncs: []
    };
    this.tKey.metadata.addTSSData({
      tssTag: this.tKey.tssTag,
      factorPubs: updatedFactorPubs,
      factorEncs
    });

    // if (!this.tKey.manualSync) await this.tKey._syncShareMetadata();
  }

  async getMetadataShare() {
    try {
      var _this$tKey5, _this$tKey6;
      const polyId = (_this$tKey5 = this.tKey) === null || _this$tKey5 === void 0 ? void 0 : _this$tKey5.metadata.getLatestPublicPolynomial().getPolynomialID();
      const shares = (_this$tKey6 = this.tKey) === null || _this$tKey6 === void 0 ? void 0 : _this$tKey6.shares[polyId];
      let share = null;
      for (const shareIndex in shares) {
        if (shareIndex !== SOCIAL_TKEY_INDEX.toString()) {
          share = shares[shareIndex];
        }
      }
      if (!share) throw new Error("no metadata share found");
      return share;
    } catch (err) {
      log.error("create device share error", err);
      throw new Error(err.message);
    }
  }
  async deleteMetadataShareBackup(factorKey) {
    var _this$tkey, _this$tkey2;
    await this.tKey.addLocalMetadataTransitions({
      input: [{
        message: SHARE_DELETED,
        dateAdded: Date.now()
      }],
      privKey: [factorKey]
    });
    if (!((_this$tkey = this.tkey) !== null && _this$tkey !== void 0 && _this$tkey.manualSync)) await ((_this$tkey2 = this.tkey) === null || _this$tkey2 === void 0 ? void 0 : _this$tkey2.syncLocalMetadataTransitions());
  }
  async backupMetadataShare(factorKey) {
    var _this$tKey7, _this$tkey3, _this$tkey4;
    const metadataShare = await this.getMetadataShare();

    // Set metadata for factor key backup
    await ((_this$tKey7 = this.tKey) === null || _this$tKey7 === void 0 ? void 0 : _this$tKey7.addLocalMetadataTransitions({
      input: [metadataShare],
      privKey: [factorKey]
    }));
    if (!((_this$tkey3 = this.tkey) !== null && _this$tkey3 !== void 0 && _this$tkey3.manualSync)) await ((_this$tkey4 = this.tkey) === null || _this$tkey4 === void 0 ? void 0 : _this$tkey4.syncLocalMetadataTransitions());
  }
  async addFactorDescription(factorKey, shareDescription) {
    var _this$tKey8;
    let additionalMetadata = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    let updateMetadata = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    const {
      tssIndex
    } = await this.tKey.getTSSShare(factorKey);
    const tkeyPoint = getPubKeyPoint(factorKey);
    const factorPub = Point.fromTkeyPoint(tkeyPoint).toBufferSEC1(true).toString("hex");
    const params = _objectSpread(_objectSpread({
      module: shareDescription,
      dateAdded: Date.now()
    }, additionalMetadata), {}, {
      tssShareIndex: tssIndex
    });
    await ((_this$tKey8 = this.tKey) === null || _this$tKey8 === void 0 ? void 0 : _this$tKey8.addShareDescription(factorPub, JSON.stringify(params), updateMetadata));
  }
  async setupProvider() {
    const signingProvider = new EthereumSigningProvider({
      config: {
        chainConfig: this.options.chainConfig
      }
    });
    await signingProvider.setupProvider({
      sign: this.sign,
      getPublic: this.getPublic
    });
    this.privKeyProvider = signingProvider;
  }
  updateState(newState) {
    this.state = _objectSpread(_objectSpread({}, this.state), newState);
  }
  resetState() {
    this.tkey = null;
    this.privKeyProvider = null;
  }
  _getOAuthKey(result) {
    return TorusUtils.getPostboxKey(result);
  }
  _getSignatures(sessionData) {
    return sessionData.map(session => JSON.stringify({
      data: session.token,
      sig: session.signature
    }));
  }
  async getSigningSignatures(data) {
    if (!this.signatures) throw new Error("signatures not present");
    if (this.options.authorizationUrl.length === 0) {
      if (this.state.remoteClient && !this.options.allowNoAuthorizationForRemoteClient) {
        throw new Error("remote client is present, authorizationUrl is required");
      }
      return this.signatures;
    }
    const sigPromise = this.options.authorizationUrl.map(async url => {
      const {
        sig
      } = await post(url, {
        signatures: this.signatures,
        verifier: this.verifier,
        verifierID: this.verifierId,
        clientID: this.options.web3AuthClientId,
        data
      });
      return sig;
    });
    return Promise.all(sigPromise);
  }
  async remoteSign(msgHash) {
    if (!this.state.remoteClient.remoteClientUrl) throw new Error("remoteClientUrl not present");

    // PreSetup
    const {
      torusNodeTSSEndpoints
    } = await this.nodeDetailManager.getNodeDetails({
      verifier: "test-verifier",
      verifierId: "test@example.com"
    });
    const tssCommits = this.tKey.getTSSCommits();
    const tssNonce = this.getTssNonce() || 0;
    const vid = `${this.verifier}${DELIMITERS.Delimiter1}${this.verifierId}`;
    const sessionId = `${vid}${DELIMITERS.Delimiter2}default${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}`;
    const parties = 4;
    const clientIndex = parties - 1;
    const {
      nodeIndexes
    } = await this.tKey.serviceProvider.getTSSPubKey(this.tKey.tssTag, this.tKey.metadata.tssNonces[this.tKey.tssTag]);
    if (parties - 1 > nodeIndexes.length) {
      throw new Error(`Not enough nodes to perform TSS - parties :${parties}, nodeIndexes:${nodeIndexes.length}`);
    }
    const {
      endpoints,
      tssWSEndpoints,
      partyIndexes,
      nodeIndexesReturned
    } = generateTSSEndpoints(torusNodeTSSEndpoints, parties, clientIndex, nodeIndexes);
    const factor = Point$1.fromCompressedPub(this.state.remoteClient.remoteFactorPub);
    const factorEnc = this.tKey.getFactorEncs(factor);
    const data = {
      dataRequired: {
        factorEnc,
        sessionId,
        tssNonce,
        nodeIndexes: nodeIndexesReturned,
        tssCommits: tssCommits.map(commit => commit.toJSON()),
        signatures: await this.getSigningSignatures(msgHash.toString("hex")),
        serverEndpoints: {
          endpoints,
          tssWSEndpoints,
          partyIndexes
        }
      },
      msgHash: msgHash.toString("hex")
    };
    const result = await post(`${this.state.remoteClient.remoteClientUrl}/api/v3/mpc/sign`, data, {
      headers: {
        Authorization: `Bearer ${this.state.remoteClient.remoteClientToken}`
      }
    });
    const {
      r,
      s,
      v
    } = result.data;
    return {
      v: parseInt(v),
      r: Buffer.from(r, "hex"),
      s: Buffer.from(s, "hex")
    };
  }
}

export { AuthenticatorService, BrowserStorage, COREKIT_STATUS, CURVE, DEFAULT_CHAIN_CONFIG, DELIMITERS, ERRORS, FIELD_ELEMENT_HEX_LEN, FactorKeyTypeShareDescription, MAX_FACTORS, MemoryStorage, Point, SCALAR_LEN, SOCIAL_FACTOR_INDEX, SOCIAL_TKEY_INDEX, SmsService, TssSecurityQuestion, TssSecurityQuestionStore, TssShareType, USER_PATH, VALID_SHARE_INDICES, WEB3AUTH_NETWORK, Web3AuthMPCCoreKit, Web3AuthStateFromJSON, addFactorAndRefresh, deleteFactorAndRefresh, generateFactorKey, generateTSSEndpoints, getHashedPrivateKey, getWebBrowserFactor, keyToMnemonic, mnemonicToKey, parseToken, refreshTssShares, remoteRefreshTssShares, scalarBNToBufferSEC1, storageAvailable, storeWebBrowserFactor };
//# sourceMappingURL=mpcCoreKit.esm.js.map
