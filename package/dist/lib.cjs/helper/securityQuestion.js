'use strict';

var _objectSpread = require('@babel/runtime/helpers/objectSpread2');
var _defineProperty = require('@babel/runtime/helpers/defineProperty');
var commonTypes = require('@tkey/common-types');
var tss = require('@tkey/tss');
var torus_js = require('@toruslabs/torus.js');
var BN = require('bn.js');
var constants = require('../constants.js');

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
      shareType = constants.TssShareType.RECOVERY;
    } else if (!constants.VALID_SHARE_INDICES.includes(shareType)) {
      throw new Error(`invalid share type: must be one of ${constants.VALID_SHARE_INDICES}`);
    }
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (storeDomain && storeDomain.question) {
      throw new Error("Security question already exists");
    }

    // const pubKey = Point.fromTkeyPoint(mpcCoreKit.tKey.getTSSPub()).toBufferSEC1(true).toString("hex");
    const pubKey = tkey.getKeyDetails().pubKey.toSEC1(commonTypes.secp256k1, true).toString("hex") + tkey.tssTag;
    let hash = torus_js.keccak256(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const descriptionFinal = _objectSpread({
      question
    }, description);
    await mpcCoreKit.createFactor({
      factorKey: factorKeyBN,
      shareType,
      shareDescription: constants.FactorKeyTypeShareDescription.SecurityQuestions,
      additionalMetadata: descriptionFinal
    });
    // set store domain
    const tkeyPt = tss.getPubKeyPoint(factorKeyBN, tss.factorKeyCurve);
    const factorPub = tkeyPt.toSEC1(tss.factorKeyCurve, true).toString("hex");
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
    const pubKey = tkey.getKeyDetails().pubKey.toSEC1(commonTypes.secp256k1, true).toString("hex") + tkey.tssTag;
    const domainKey = `${this.storeDomainName}:${params.mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey);
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    const preHash = answer + pubKey;
    let hash = torus_js.keccak256(Buffer.from(preHash, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const factorKeyPt = tss.getPubKeyPoint(factorKeyBN, tss.factorKeyCurve);
    if (factorKeyPt.toSEC1(tss.factorKeyCurve, true).toString("hex") !== store.factorPublicKey) {
      throw new Error("Invalid answer");
    }

    // create new factor key
    const prenewHash = newAnswer + pubKey;
    let newHash = torus_js.keccak256(Buffer.from(prenewHash, "utf8"));
    newHash = newHash.startsWith("0x") ? newHash.slice(2) : newHash;
    const newAnswerBN = new BN(newHash, "hex");
    const newFactorPt = commonTypes.Point.fromScalar(newAnswerBN, tss.factorKeyCurve);
    await mpcCoreKit.createFactor({
      factorKey: newAnswerBN,
      shareType: parseInt(store.shareIndex),
      shareDescription: constants.FactorKeyTypeShareDescription.SecurityQuestions
    });

    // update mpcCoreKit state to use new factor key during change password if mpc factor key is security question factor
    if (mpcCoreKit.state.factorKey.eq(factorKeyBN)) {
      await mpcCoreKit.inputFactorKey(newAnswerBN);
    }
    // delete after create factor to prevent last key issue
    // delete old factor key and device share
    await mpcCoreKit.deleteFactor(factorKeyPt, factorKeyBN);
    store.factorPublicKey = newFactorPt.toSEC1(tss.factorKeyCurve, true).toString("hex");
    store.question = newQuestion;
    tkey.metadata.setGeneralStoreDomain(domainKey, store.toJSON());

    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();
  }

  // Should we check with answer before deleting?
  async deleteSecurityQuestion(mpcCoreKit, deleteFactorKey = true) {
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
        await mpcCoreKit.deleteFactor(commonTypes.Point.fromSEC1(tss.factorKeyCurve, store.factorPublicKey));
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
    const pubKey = tkey.getKeyDetails().pubKey.toSEC1(commonTypes.secp256k1, true).toString("hex") + tkey.tssTag;
    let hash = torus_js.keccak256(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const factorKeyPt = commonTypes.Point.fromScalar(factorKeyBN, tss.factorKeyCurve);
    if (factorKeyPt.toSEC1(tss.factorKeyCurve, true).toString("hex") !== store.factorPublicKey) {
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

exports.TssSecurityQuestion = TssSecurityQuestion;
exports.TssSecurityQuestionStore = TssSecurityQuestionStore;
