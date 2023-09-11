import { decrypt, encrypt, EncryptedMessage, getPubKeyECC, StringifiedType } from "@tkey-mpc/common-types";
import { keccak256 } from "@toruslabs/torus.js";
import BN from "bn.js";

import { generateFactorKey } from "..//utils";
import { FactorKeyTypeShareDescription, TssFactorIndexType } from "../constants";
import type { Web3AuthMPCCoreKit } from "../mpcCoreKit";

export class TssSecurityQuestionStore {
  shareIndex: string;

  associatedFactor: EncryptedMessage;

  question: string;

  constructor(shareIndex: string, associatedFactor: EncryptedMessage, question: string) {
    this.shareIndex = shareIndex;
    this.associatedFactor = associatedFactor;
    this.question = question;
  }

  static fromJSON(json: StringifiedType) {
    const { shareIndex, encrypted, question } = json;
    return new TssSecurityQuestionStore(shareIndex, encrypted, question);
  }

  toJSON(): StringifiedType {
    return {
      shareIndex: this.shareIndex,
      encrypted: this.associatedFactor,
      question: this.question,
    };
  }
}

export interface setSecurityQuestionParams {
  mpcCoreKit: Web3AuthMPCCoreKit;
  question: string;
  answer: string;
  description?: Record<string, string>;
  factorKey?: string;
}

export interface changeSecurityQuestionParams {
  mpcCoreKit: Web3AuthMPCCoreKit;
  newQuestion: string;
  newAnswer: string;
  answer: string;
}

export class TssSecurityQuestion {
  StoreDomainName = "tssSecurityQuestion";

  async setSecurityQuestion(params: setSecurityQuestionParams) {
    const { mpcCoreKit, question, answer, description, factorKey } = params;

    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    if (!question || !answer) {
      throw new Error("question and answer are required");
    }
    if (answer.length < 10) {
      throw new Error("answer must be at least 10 characters long");
    }
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.StoreDomainName) as StringifiedType;
    if (storeDomain && storeDomain.question) {
      throw new Error("Security question already exists");
    }

    const factorKeyBN = factorKey ? new BN(factorKey, 16) : generateFactorKey().private;

    await mpcCoreKit.createFactor(factorKeyBN, TssFactorIndexType.DEVICE, FactorKeyTypeShareDescription.SecurityQuestions, description);

    // TODO: check for better key distribution solution, keccah256 has not even distribution due to p modulus
    // does the getPubKeyEcc auto modulus the key or throw error?
    const answerBN = new BN(keccak256(Buffer.from(answer, "utf8")), "hex");
    const associatedFactor = await encrypt(getPubKeyECC(answerBN), factorKeyBN.toBuffer());
    // set store domain
    const storeData = new TssSecurityQuestionStore(TssFactorIndexType.DEVICE.toString(), associatedFactor, question);
    tkey.metadata.setGeneralStoreDomain(this.StoreDomainName, storeData.toJSON());

    // check for auto commit
    await tkey._syncShareMetadata();
  }

  async changeSecurityQuestion(params: changeSecurityQuestionParams) {
    const { mpcCoreKit, newQuestion, newAnswer, answer } = params;
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.StoreDomainName) as StringifiedType;
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }

    const store = TssSecurityQuestionStore.fromJSON(storeDomain);

    const answerBN = new BN(keccak256(Buffer.from(answer, "utf8")), "hex");
    const decryptKey = getPubKeyECC(answerBN);

    const factorKey = await decrypt(decryptKey, store.associatedFactor);

    const newAnswerBN = new BN(keccak256(Buffer.from(newAnswer, "utf8")), "hex");
    const newEncryptKey = getPubKeyECC(newAnswerBN);
    const newEncrypted = await encrypt(newEncryptKey, factorKey);

    store.associatedFactor = newEncrypted;
    store.question = newQuestion;
    tkey.metadata.setGeneralStoreDomain(this.StoreDomainName, store.toJSON());

    // check for auto commit
    await tkey._syncShareMetadata();
  }

  // Should we check with answer before deleting?
  async deleteSecurityQuestion(mpcCoreKit: Web3AuthMPCCoreKit) {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const tkey = mpcCoreKit.tKey;
    const emptyStore = {};
    tkey.metadata.setGeneralStoreDomain(this.StoreDomainName, emptyStore);
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
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.StoreDomainName) as StringifiedType;
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);

    const answerBN = new BN(keccak256(Buffer.from(answer, "utf8")), "hex");
    const decryptKey = getPubKeyECC(answerBN);
    const factorKey = await decrypt(decryptKey, store.associatedFactor);
    return factorKey.toString("hex", 64);
  }

  getQuestion(mpcCoreKit: Web3AuthMPCCoreKit): string {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.StoreDomainName) as StringifiedType;
    if (!storeDomain || !storeDomain.question) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    return store.question;
  }
}
