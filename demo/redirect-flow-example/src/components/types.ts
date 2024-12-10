import { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export type ButtonClassesKey = "container" | "loader";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "secondary" | "tertiary" | "text";
  block?: boolean;
  loadingWithText?: boolean;
  pill?: boolean;
  rounded?: boolean;
  classes?: Partial<Record<ButtonClassesKey, string>>;
  component?: string;
  href?: string;
  loading?: boolean;
}

export type LoginFormClassesKey =
  | "container"
  | "loginItemContainer"
  | "loginItem"
  | "socialLoginMsg"
  | "expandBtn"
  | "expandBtnContainer"
  | "existingBtn";

export type SocialLoginObj = {
  icon?: string;
  verifier?: string;
  description?: string;
  block?: boolean;
  type?: ButtonProps["variant"];
};

export type ExistingLoginObj = {
  verifier?: string;
  icon?: string;
  loginHint?: string;
  label?: string;
  iconSize?: string;
  iconStyle?: string;
};

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  textSize?: "small" | "medium" | "large";
  label?: string;
  placeholder?: string;
  value?: string;
  type?: string;
  disabled?: boolean;
  id?: string;
  error?: boolean;
  success?: boolean;
  helperText?: string;
  pill?: boolean;
  toolTipIcon?: string;
  showToolTipIcon?: boolean;
  trailingIcon?: string;
  endIcon?: string;
  classes?: Partial<Record<string, string>>;
  onTrailingIconClick?: () => void;
  onEndIconClick?: () => void;
  onTooltipClick?: () => void;
}

export interface LoginFormProps {
  socialLogins?: SocialLoginObj[];
  pill?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  socialLoginMessage?: string;
  showInput?: boolean;
  inputBtnLabel?: string;
  inputProps?: TextFieldProps;
  inputExpandBtnProps?: ButtonProps;
  gridCols?: 3 | 2;
  inputBtnProps?: ButtonProps;
  primaryBtn?: "social" | "input";
  classes?: Partial<Record<LoginFormClassesKey, string>>;
  isExistingLogin?: boolean;
  existingLoginProps?: ExistingLoginObj;
  existingLabelInline?: boolean;
  divider?: boolean;
  onSocialLoginClick?: (item: SocialLoginObj, index: number) => void;
  onExistingLoginClick?: (existingLoginDetails: ExistingLoginObj) => void;
  onInputBtnClick?: () => void;
  children?: React.ReactNode;
}

export enum LOGIN_PROVIDER {
  GOOGLE = "google",
  FACEBOOK = "facebook",
  REDDIT = "reddit",
  DISCORD = "discord",
  TWITCH = "twitch",
  APPLE = "apple",
  LINE = "line",
  GITHUB = "github",
  KAKAO = "kakao",
  LINKEDIN = "linkedin",
  TWITTER = "twitter",
  WEIBO = "weibo",
  WECHAT = "wechat",
  FARCASTER = "farcaster",
  EMAIL_PASSWORDLESS = "email_passwordless",
  SMS_PASSWORDLESS = "sms_passwordless",
  WEBAUTHN = "webauthn",
  JWT = "jwt",
}