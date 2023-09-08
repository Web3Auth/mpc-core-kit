import { decrypt, encrypt, EncryptedMessage, getPubKeyECC, StringifiedType } from "@tkey-mpc/common-types";
import { keccak256 } from "@toruslabs/torus.js";
import BN from "bn.js";

import { FactorKeyTypeShareDescription, TssFactorIndexType } from "../constants";
import { Web3AuthMPCCoreKit } from "../mpcCoreKit";

export class TssSecurityQuestionStore {
  shareIndex: string;

  associatedFactor: EncryptedMessage;

  questions: string;

  constructor(shareIndex: string, associatedFactor: EncryptedMessage, questions: string) {
    this.shareIndex = shareIndex;
    this.associatedFactor = associatedFactor;
    this.questions = questions;
  }

  static fromJSON(json: StringifiedType) {
    const { shareIndex, encrypted, questions } = json;
    return new TssSecurityQuestionStore(shareIndex, encrypted, questions);
  }

  toJSON(): StringifiedType {
    return {
      shareIndex: this.shareIndex,
      encrypted: this.associatedFactor,
      questions: this.questions,
    };
  }
}

export class TssSecurityQuestion {
  StoreDomainName = "tssSecurityQuestion";

  async setSecurityQuestion(
    mpcCoreKit: Web3AuthMPCCoreKit,
    question: string,
    answer: string,
    description?: Record<string, string>,
    factorKey?: string
  ) {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    if (!question || !answer) {
      throw new Error("question and password are required");
    }
    if (answer.length < 10) {
      throw new Error("password must be at least 10 characters long");
    }
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.StoreDomainName) as StringifiedType;
    if (storeDomain && storeDomain.questions) {
      throw new Error("Security question already exists");
    }

    const factorKeyBN = factorKey ? new BN(factorKey, 16) : Web3AuthMPCCoreKit.generateFactorKey().private;

    await mpcCoreKit.createFactor(factorKeyBN, TssFactorIndexType.DEVICE, FactorKeyTypeShareDescription.SecurityQuestions, description);

    // TODO: check for better key distribution solution, keccah256 has not even distribution due to p modulus
    // does the getPubKeyEcc auto modulus the key or throw error?
    const passwordBN = new BN(keccak256(Buffer.from(answer, "utf8")), "hex");
    const associatedFactor = await encrypt(getPubKeyECC(passwordBN), factorKeyBN.toBuffer());
    // set store domain
    const storeData = new TssSecurityQuestionStore(TssFactorIndexType.DEVICE.toString(), associatedFactor, question);
    tkey.metadata.setGeneralStoreDomain(this.StoreDomainName, storeData.toJSON());

    // check for auto commit
    tkey._syncShareMetadata();
  }

  async changeSecurityQuestion(mpcCoreKit: Web3AuthMPCCoreKit, newQuestion: string, newAnswer: string, answer: string) {
    // Check for existing security question
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.StoreDomainName) as StringifiedType;
    if (!storeDomain || !storeDomain.questions) {
      throw new Error("Security question does not exists");
    }

    const store = TssSecurityQuestionStore.fromJSON(storeDomain);

    const passwordBN = new BN(keccak256(Buffer.from(answer, "utf8")), "hex");
    const decryptKey = getPubKeyECC(passwordBN);

    const factorKey = await decrypt(decryptKey, store.associatedFactor);

    const newPasswordBN = new BN(keccak256(Buffer.from(newAnswer, "utf8")), "hex");
    const newEncryptKey = getPubKeyECC(newPasswordBN);
    const newEncrypted = await encrypt(newEncryptKey, factorKey);

    store.associatedFactor = newEncrypted;
    store.questions = newQuestion;
    tkey.metadata.setGeneralStoreDomain(this.StoreDomainName, store.toJSON());

    // check for auto commit
    tkey._syncShareMetadata();
  }

  // Should we check with answer before deleting?
  async deleteSecurityQuestion(mpcCoreKit: Web3AuthMPCCoreKit) {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const tkey = mpcCoreKit.tKey;
    const emptyStore = {};
    await tkey.metadata.setGeneralStoreDomain(this.StoreDomainName, emptyStore);
    // check for auto commit
    tkey._syncShareMetadata();
  }

  async recoverSecurityQuestionFactor(mpcCoreKit: Web3AuthMPCCoreKit, answer: string): Promise<string> {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    if (!answer) {
      throw new Error("question and password are required");
    }
    if (answer.length < 10) {
      throw new Error("password must be at least 10 characters long");
    }

    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.StoreDomainName) as StringifiedType;
    if (!storeDomain || !storeDomain.questions) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);

    const passwordBN = new BN(keccak256(Buffer.from(answer, "utf8")), "hex");
    const decryptKey = getPubKeyECC(passwordBN);
    const factorKey = await decrypt(decryptKey, store.associatedFactor);
    return factorKey.toString("hex");
  }

  getQuestion(mpcCoreKit: Web3AuthMPCCoreKit): string {
    if (!mpcCoreKit.tKey) {
      throw new Error("Tkey not initialized, call init first.");
    }
    const tkey = mpcCoreKit.tKey;
    const storeDomain = tkey.metadata.getGeneralStoreDomain(this.StoreDomainName) as StringifiedType;
    if (!storeDomain || !storeDomain.questions) {
      throw new Error("Security question does not exists");
    }
    const store = TssSecurityQuestionStore.fromJSON(storeDomain);
    return store.questions;
  }
}
