import { FACTOR_KEY_TYPE, getPubKeyPoint, Point as tkeyPoint, StringifiedType } from "@tkey/common-types";
import { keccak256 } from "@toruslabs/torus.js";
import BN from "bn.js";

import { FactorKeyTypeShareDescription, TssShareType, VALID_SHARE_INDICES } from "../constants";
import type { Web3AuthMPCCoreKit } from "../mpcCoreKit";
import { Point } from "../point";

export class TssSecurityQuestionStore {
  shareIndex: string;

  factorPublicKey: string;

  question: string;

  constructor(shareIndex: string, factorPublicKey: string, question: string) {
    this.shareIndex = shareIndex;
    this.factorPublicKey = factorPublicKey;
    this.question = question;
  }

  static fromJSON(json: StringifiedType) {
    const { shareIndex, factorPublicKey, question } = json;
    return new TssSecurityQuestionStore(shareIndex, factorPublicKey, question);
  }

  toJSON(): StringifiedType {
    return {
      shareIndex: this.shareIndex,
      factorPublicKey: this.factorPublicKey,
      question: this.question,
    };
  }
}

export interface setSecurityQuestionParams {
  mpcCoreKit: Web3AuthMPCCoreKit;
  question: string;
  answer: string;
  shareType?: TssShareType;
  description?: Record<string, string>;
  tssIndex?: TssShareType;
}

export interface changeSecurityQuestionParams {
  mpcCoreKit: Web3AuthMPCCoreKit;
  newQuestion: string;
  newAnswer: string;
  answer: string;
}

export class TssSecurityQuestion {
  storeDomainName = "tssSecurityQuestion";

  async setSecurityQuestion(params: setSecurityQuestionParams): Promise<string> {
    const { mpcCoreKit, question, answer, description } = params;
    let { shareType } = params;

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
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey) as StringifiedType;
    if (storeDomain && storeDomain.question) {
      throw new Error("Security question already exists");
    }

    // const pubKey = Point.fromTkeyPoint(mpcCoreKit.tKey.getTSSPub()).toBufferSEC1(true).toString("hex");
    const pubKey = Point.fromTkeyPoint(tkey.getKeyDetails().pubKey).toBufferSEC1(true).toString("hex") + tkey.tssTag;
    let hash = keccak256(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");

    const descriptionFinal = {
      question,
      ...description,
    };

    await mpcCoreKit.createFactor({
      factorKey: factorKeyBN,
      shareType,
      shareDescription: FactorKeyTypeShareDescription.SecurityQuestions,
      additionalMetadata: descriptionFinal,
    });
    // set store domain
    const tkeyPt = getPubKeyPoint(factorKeyBN, FACTOR_KEY_TYPE);
    const factorPub = Point.fromTkeyPoint(tkeyPt).toBufferSEC1(true).toString("hex");
    const storeData = new TssSecurityQuestionStore(shareType.toString(), factorPub, question);
    tkey.metadata.setGeneralStoreDomain(domainKey, storeData.toJSON());

    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();

    return factorKeyBN.toString("hex").padStart(64, "0");
  }

  async changeSecurityQuestion(params: changeSecurityQuestionParams) {
    const { mpcCoreKit, newQuestion, newAnswer, answer } = params;
    if (!newQuestion || !newAnswer || !answer) {
      throw new Error("question and answer are required");
    }
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    // const pubKey = Point.fromTkeyPoint(mpcCoreKit.tKey.getTSSPub()).toBufferSEC1(true).toString("hex");
    const pubKey = Point.fromTkeyPoint(tkey.getKeyDetails().pubKey).toBufferSEC1(true).toString("hex") + tkey.tssTag;

    const domainKey = `${this.storeDomainName}:${params.mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey) as StringifiedType;
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }

    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    const preHash = answer + pubKey;
    let hash = keccak256(Buffer.from(preHash, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const factorKeyPt = Point.fromTkeyPoint(getPubKeyPoint(factorKeyBN, FACTOR_KEY_TYPE));
    if (factorKeyPt.toBufferSEC1(true).toString("hex") !== store.factorPublicKey) {
      throw new Error("Invalid answer");
    }

    // create new factor key
    const prenewHash = newAnswer + pubKey;
    let newHash = keccak256(Buffer.from(prenewHash, "utf8"));
    newHash = newHash.startsWith("0x") ? newHash.slice(2) : newHash;
    const newAnswerBN = new BN(newHash, "hex");
    const newFactorPt = Point.fromTkeyPoint(getPubKeyPoint(newAnswerBN, FACTOR_KEY_TYPE));
    await mpcCoreKit.createFactor({
      factorKey: newAnswerBN,
      shareType: parseInt(store.shareIndex) as TssShareType,
      shareDescription: FactorKeyTypeShareDescription.SecurityQuestions,
    });

    // update mpcCoreKit state to use new factor key during change password if mpc factor key is security question factor
    if (mpcCoreKit.state.factorKey.eq(factorKeyBN)) {
      await mpcCoreKit.inputFactorKey(newAnswerBN);
    }
    // delete after create factor to prevent last key issue
    // delete old factor key and device share
    await mpcCoreKit.deleteFactor(factorKeyPt.toTkeyPoint(FACTOR_KEY_TYPE), factorKeyBN);

    store.factorPublicKey = newFactorPt.toBufferSEC1(true).toString("hex");
    store.question = newQuestion;
    tkey.metadata.setGeneralStoreDomain(domainKey, store.toJSON());

    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();
  }

  // Should we check with answer before deleting?
  async deleteSecurityQuestion(mpcCoreKit: Web3AuthMPCCoreKit, deleteFactorKey = true) {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }

    const domainKey = `${this.storeDomainName}:${mpcCoreKit.tKey.tssTag}`;
    const tkey = mpcCoreKit.tKey;
    if (deleteFactorKey) {
      const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey) as StringifiedType;
      if (!storeDomain || !storeDomain.question) {
        throw new Error("Security question does not exists");
      }

      const store = TssSecurityQuestionStore.fromJSON(storeDomain);
      if (store.factorPublicKey) {
        await mpcCoreKit.deleteFactor(tkeyPoint.fromSEC1(store.factorPublicKey, FACTOR_KEY_TYPE));
      }
    }
    tkey.metadata.deleteGeneralStoreDomain(domainKey);
    // check for auto commit
    if (!tkey.manualSync) await tkey._syncShareMetadata();
  }

  async recoverFactor(mpcCoreKit: Web3AuthMPCCoreKit, answer: string): Promise<string> {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    if (!answer) {
      throw new Error("question and answer are required");
    }

    const tkey = mpcCoreKit.tKey;

    const domainKey = `${this.storeDomainName}:${mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey) as StringifiedType;
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }

    const store = TssSecurityQuestionStore.fromJSON(storeDomain);

    // const pubKey = Point.fromTkeyPoint(mpcCoreKit.tKey.getTSSPub()).toBufferSEC1(true).toString("hex");
    const pubKey = Point.fromTkeyPoint(tkey.getKeyDetails().pubKey).toBufferSEC1(true).toString("hex") + tkey.tssTag;

    let hash = keccak256(Buffer.from(answer + pubKey, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const factorKeyBN = new BN(hash, "hex");
    const factorKeyPt = Point.fromTkeyPoint(getPubKeyPoint(factorKeyBN, FACTOR_KEY_TYPE));

    if (factorKeyPt.toBufferSEC1(true).toString("hex") !== store.factorPublicKey) {
      throw new Error("Invalid answer");
    }

    return hash;
  }

  getQuestion(mpcCoreKit: Web3AuthMPCCoreKit): string {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const tkey = mpcCoreKit.tKey;

    const domainKey = `${this.storeDomainName}:${mpcCoreKit.tKey.tssTag}`;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(domainKey) as StringifiedType;
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }

    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    return store.question;
  }
}
