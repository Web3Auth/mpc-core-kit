import { decrypt, encrypt, EncryptedMessage, getPubKeyECC, getPubKeyPoint, Point as tkeyPoint, StringifiedType } from "@tkey-mpc/common-types";
import { keccak256 } from "@toruslabs/torus.js";
import BN from "bn.js";

import { FactorKeyTypeShareDescription, TssShareType, VALID_SHARE_INDICES } from "../constants";
import type { Web3AuthMPCCoreKit } from "../mpcCoreKit";
import { Point } from "../point";
import { generateFactorKey } from "../utils";

export class TssSecurityQuestionStore {
  shareIndex: string;

  factorPublicKey: string;

  associatedFactor: EncryptedMessage;

  question: string;

  constructor(shareIndex: string, factorPublicKey: string, associatedFactor: EncryptedMessage, question: string) {
    this.shareIndex = shareIndex;
    this.factorPublicKey = factorPublicKey;
    this.associatedFactor = associatedFactor;
    this.question = question;
  }

  static fromJSON(json: StringifiedType) {
    const { shareIndex, factorPublicKey, associatedFactor, question } = json;
    return new TssSecurityQuestionStore(shareIndex, factorPublicKey, associatedFactor, question);
  }

  toJSON(): StringifiedType {
    return {
      shareIndex: this.shareIndex,
      factorPublicKey: this.factorPublicKey,
      associatedFactor: this.associatedFactor,
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
  factorKey?: string;
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
    const { mpcCoreKit, question, answer, description, factorKey } = params;
    let { shareType } = params;

    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    if (!question || !answer) {
      throw new Error("question and answer are required");
    }
    if (answer.length < 10) {
      throw new Error("answer must be at least 10 characters long");
    }
    if (!shareType) {
      shareType = TssShareType.RECOVERY;
    } else if (!VALID_SHARE_INDICES.includes(shareType)) {
      throw new Error(`invalid share type: must be one of ${VALID_SHARE_INDICES}`);
    }
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.storeDomainName) as StringifiedType;
    if (storeDomain && storeDomain.question) {
      throw new Error("Security question already exists");
    }

    // default using recovery index
    const factorTssIndex = shareType || TssShareType.RECOVERY;
    const factorKeyBN = factorKey ? new BN(factorKey, 16) : generateFactorKey().private;

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

    let hash = keccak256(Buffer.from(answer, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;

    // TODO: check for better key distribution solution, keccah256 has not even distribution due to p modulus
    // does the getPubKeyEcc auto modulus the key or throw error?
    const answerBN = new BN(hash, "hex");
    const associatedFactor = await encrypt(getPubKeyECC(answerBN), Buffer.from(factorKeyBN.toString("hex"), "hex"));
    // set store domain
    const tkeyPt = getPubKeyPoint(factorKeyBN);
    const factorPub = Point.fromTkeyPoint(tkeyPt).toBufferSEC1(true).toString("hex");
    const storeData = new TssSecurityQuestionStore(shareType.toString(), factorPub,  associatedFactor, question);
    tkey.metadata.setGeneralStoreDomain(this.storeDomainName, storeData.toJSON());

    // check for auto commit
    await tkey._syncShareMetadata();

    return factorKeyBN.toString("hex").padStart(64, "0");
  }

  async changeSecurityQuestion(params: changeSecurityQuestionParams) {
    const { mpcCoreKit, newQuestion, newAnswer, answer } = params;
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.storeDomainName) as StringifiedType;
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }

    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    let hash = keccak256(Buffer.from(answer, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const decryptKey = Buffer.from(hash, "hex");

    let factorKey;
    try {
      factorKey = await decrypt(decryptKey, store.associatedFactor);
    } catch (error) {
      throw new Error("Incorrect answer");
    }

    let newHash = keccak256(Buffer.from(newAnswer, "utf8"));
    newHash = newHash.startsWith("0x") ? newHash.slice(2) : newHash;
    const newAnswerBN = new BN(newHash, "hex");
    const newEncryptKey = getPubKeyECC(newAnswerBN);
    const newEncrypted = await encrypt(newEncryptKey, factorKey);

    store.associatedFactor = newEncrypted;
    store.question = newQuestion;
    tkey.metadata.setGeneralStoreDomain(this.storeDomainName, store.toJSON());

    // check for auto commit
    await tkey._syncShareMetadata();
  }

  // Should we check with answer before deleting?
  async deleteSecurityQuestion(mpcCoreKit: Web3AuthMPCCoreKit, deleteFactorKey = true) {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const tkey = mpcCoreKit.tKey;
    if (deleteFactorKey) {
      const storeDomain = tkey.metadata.getGeneralStoreDomain(this.storeDomainName) as StringifiedType;
      if (!storeDomain || !storeDomain.question) {
        throw new Error("Security question does not exists");
      }

      const store = TssSecurityQuestionStore.fromJSON(storeDomain);
      if (store.factorPublicKey) {
        await mpcCoreKit.deleteFactor(tkeyPoint.fromCompressedPub(store.factorPublicKey));
      }
    }
    const emptyStore = {};
    tkey.metadata.setGeneralStoreDomain(this.storeDomainName, emptyStore);
    // check for auto commit
    await tkey._syncShareMetadata();
  }

  async recoverSecurityQuestionFactor(mpcCoreKit: Web3AuthMPCCoreKit, answer: string): Promise<string> {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    if (!answer) {
      throw new Error("question and answer are required");
    }
    if (answer.length < 10) {
      throw new Error("answer must be at least 10 characters long");
    }

    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.storeDomainName) as StringifiedType;
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);

    let hash = keccak256(Buffer.from(answer, "utf8"));
    hash = hash.startsWith("0x") ? hash.slice(2) : hash;
    const decryptKey = Buffer.from(hash, "hex");
    let factorKey;
    try {
      factorKey = await decrypt(decryptKey, store.associatedFactor);
      return factorKey.toString("hex").padStart(64, "0");
    } catch (error) {
      throw new Error("Incorrect answer");
    }
  }

  getQuestion(mpcCoreKit: Web3AuthMPCCoreKit): string {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.storeDomainName) as StringifiedType;
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    return store.question;
  }
}
