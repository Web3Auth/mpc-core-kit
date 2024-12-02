import _objectSpread from '@babel/runtime/helpers/objectSpread2';
import _defineProperty from '@babel/runtime/helpers/defineProperty';
import { secp256k1, Point } from '@tkey/common-types';
import { getPubKeyPoint, factorKeyCurve } from '@tkey/tss';
import { keccak256 } from '@toruslabs/torus.js';
import BN from 'bn.js';
import { TssShareType, VALID_SHARE_INDICES, FactorKeyTypeShareDescription } from '../constants.js';

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
    const pubKey = tkey.getKeyDetails().pubKey.toSEC1(secp256k1, true).toString("hex") + tkey.tssTag;
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
    const tkeyPt = getPubKeyPoint(factorKeyBN, factorKeyCurve);
    const factorPub = tkeyPt.toSEC1(factorKeyCurve, true).toString("hex");
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
    const pubKey = tkey.getKeyDetails().pubKey.toSEC1(secp256k1, true).toString("hex") + tkey.tssTag;
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
    const factorKeyPt = getPubKeyPoint(factorKeyBN, factorKeyCurve);
    if (factorKeyPt.toSEC1(factorKeyCurve, true).toString("hex") !== store.factorPublicKey) {
      throw new Error("Invalid answer");
    }

    // create new factor key
    const prenewHash = newAnswer + pubKey;
    let newHash = keccak256(Buffer.from(prenewHash, "utf8"));
    newHash = newHash.startsWith("0x") ? newHash.slice(2) : newHash;
    const newAnswerBN = new BN(newHash, "hex");
    const newFactorPt = Point.fromScalar(newAnswerBN, factorKeyCurve);
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
    await mpcCoreKit.deleteFactor(factorKeyPt, factorKeyBN);
    store.factorPublicKey = newFactorPt.toSEC1(factorKeyCurve, true).toString("hex");
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
        await mpcCoreKit.deleteFactor(Point.fromSEC1(factorKeyCurve, store.factorPublicKey));
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
    const pubKey = tkey.getKeyDetails().pubKey.toSEC1(secp256k1, true).toString("hex") + tkey.tssTag;
    let hash = keccak256(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const factorKeyPt = Point.fromScalar(factorKeyBN, factorKeyCurve);
    if (factorKeyPt.toSEC1(factorKeyCurve, true).toString("hex") !== store.factorPublicKey) {
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

export { TssSecurityQuestion, TssSecurityQuestionStore };
