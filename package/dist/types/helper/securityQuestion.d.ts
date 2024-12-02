import { StringifiedType } from "@tkey/common-types";
import { TssShareType } from "../constants";
import type { Web3AuthMPCCoreKit } from "../mpcCoreKit";
export declare class TssSecurityQuestionStore {
    shareIndex: string;
    factorPublicKey: string;
    question: string;
    constructor(shareIndex: string, factorPublicKey: string, question: string);
    static fromJSON(json: StringifiedType): TssSecurityQuestionStore;
    toJSON(): StringifiedType;
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
export declare class TssSecurityQuestion {
    storeDomainName: string;
    setSecurityQuestion(params: setSecurityQuestionParams): Promise<string>;
    changeSecurityQuestion(params: changeSecurityQuestionParams): Promise<void>;
    deleteSecurityQuestion(mpcCoreKit: Web3AuthMPCCoreKit, deleteFactorKey?: boolean): Promise<void>;
    recoverFactor(mpcCoreKit: Web3AuthMPCCoreKit, answer: string): Promise<string>;
    getQuestion(mpcCoreKit: Web3AuthMPCCoreKit): string;
}
