export declare const WEB3AUTH_NETWORK: {
    readonly MAINNET: "sapphire_mainnet";
    readonly DEVNET: "sapphire_devnet";
};
export declare const USER_PATH: {
    readonly NEW: "NewAccount";
    readonly EXISTING: "ExistingAccount";
    readonly REHYDRATE: "RehydrateAccount";
    readonly RECOVER: "RecoverAccount";
};
export declare enum FactorKeyTypeShareDescription {
    HashedShare = "hashedShare",
    SecurityQuestions = "tssSecurityQuestions",
    DeviceShare = "deviceShare",
    SeedPhrase = "seedPhrase",
    PasswordShare = "passwordShare",
    SocialShare = "socialShare",
    Other = "Other"
}
export declare const DELIMITERS: {
    Delimiter1: string;
    Delimiter2: string;
    Delimiter3: string;
    Delimiter4: string;
};
export declare const ERRORS: {
    TKEY_SHARES_REQUIRED: string;
    INVALID_BACKUP_SHARE: string;
};
export declare const SOCIAL_FACTOR_INDEX = 1;
/**
 * Defines the TSS Share Index in a simplified way for better implementation.
 **/
export declare enum TssShareType {
    DEVICE = 2,
    RECOVERY = 3
}
export declare const VALID_SHARE_INDICES: TssShareType[];
export declare const SCALAR_LEN = 32;
export declare const FIELD_ELEMENT_HEX_LEN: number;
export declare const MAX_FACTORS = 10;
export declare const SOCIAL_TKEY_INDEX = 1;
