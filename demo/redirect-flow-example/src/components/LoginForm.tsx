import * as React from "react";
import { useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { TextField } from "./TextField";
import { cn } from "./Card";
import { Image } from "./Image";
import { LoginFormProps } from "./types";

const LoginForm: React.FC<LoginFormProps> = ({
  socialLogins = [],
  pill = false,
  expandLabel = "View More",
  collapseLabel = "View Less",
  socialLoginMessage = "We do not store any data related to your social logins.",
  showInput = true,
  inputBtnLabel = "",
  inputProps = {},
  inputExpandBtnProps = {},
  gridCols = 3,
  inputBtnProps = {},
  primaryBtn = "social",
  classes = {},
  isExistingLogin = false,
  existingLoginProps = {},
  existingLabelInline = false,
  divider = false,
  onSocialLoginClick,
  onExistingLoginClick,
  onInputBtnClick,
  children,
}) => {
  const [viewMoreOptions, setViewMoreOptions] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const getIcon = (provider: string) => {
    if (provider === "twitter") {
      return "twitter-x";
    }
    return provider;
  };

  const toggleViewMoreOptions = () => {
    setViewMoreOptions(!viewMoreOptions);
    if (!imagesLoaded) {
      setImagesLoaded(true);
    }
  };

  const isHiddenIcon = (index: number) => {
    if (imagesLoaded) return false;
    return !viewMoreOptions && index > 3;
  };

  return (
    <div className={cn("w-full flex flex-col", classes.container)}>
      {isExistingLogin && existingLoginProps?.verifier && (
        <Button
          size={existingLabelInline ? "xl" : "md"}
          className={cn("mb-4", classes.existingBtn)}
          onClick={() => onExistingLoginClick && onExistingLoginClick(existingLoginProps)}
        >
          <div className="flex items-center justify-center gap-3">
            <Icon
              name={existingLoginProps?.icon || ""}
              className={cn("w-6", existingLoginProps?.iconStyle)}
              size={existingLoginProps?.iconSize || "24"}
            />
            <p className={cn("text-sm font-medium flex items-center gap-1", { "flex-col": existingLabelInline })}>
              <span className="capitalize">{existingLoginProps?.label || "Continue With"} {existingLoginProps?.verifier || ""}</span>
              <span className="font-semibold">{existingLoginProps.loginHint}</span>
            </p>
          </div>
        </Button>
      )}
      {socialLogins.length > 0 && (
        <div className={cn(
          "overflow-y-hidden grid gap-4 -m-1 p-1 transition-all duration-300 ease-in-out",
          { "max-h-[500px]": viewMoreOptions, "max-h-[106px]": !viewMoreOptions, "grid-cols-3": gridCols === 3, "grid-cols-4": gridCols === 2 },
          classes.loginItemContainer
        )}>
          {socialLogins.map((item, index) => (
            <div
              key={item.icon}
              className={cn("group", {
                "col-span-3": !isExistingLogin && (item?.block || index === 0),
                "col-span-2": gridCols === 2,
                "col-span-4": gridCols === 2 && (item?.block || index === 0),
              })}
            >
              <Button
                type="button"
                block
                className={"rounded-full"}
                aria-label={`${item.icon} Login Button`}
                variant="secondary"
                onClick={() => onSocialLoginClick && onSocialLoginClick(item, index)}
              >
                <div>
                  <Image isHidden={isHiddenIcon(index)} icon={getIcon(item.icon || "")} />
                </div>
                {item?.description && !isExistingLogin && (
                  <div className="flex flex-col items-center ml-2">
                    {item?.description}
                  </div>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
      {socialLoginMessage && (
        <p className={cn("text-xs font-medium text-app-gray-500 dark:text-app-gray-200 mt-4", classes.socialLoginMsg)}>
          {socialLoginMessage}
        </p>
      )}
      {socialLogins.length > 0 && socialLogins.length > 4 && (
        <div className={cn("flex items-center justify-end my-4", { "my-2": divider }, classes.expandBtnContainer)}>
          <Button
            variant="text"
            pill={pill}
            {...inputExpandBtnProps}
            className={cn("text-sm font-medium", classes.expandBtn)}
            onClick={toggleViewMoreOptions}
          >
            {viewMoreOptions ? collapseLabel : expandLabel}
          </Button>
        </div>
      )}
      {divider && (
        <div className="flex items-center mb-2 gap-2">
          <div className="h-[1px] w-full bg-app-gray-200 dark:bg-app-gray-600"></div>
          <span className="text-app-gray-600 dark:text-app-gray-200 text-sm font-normal">or</span>
          <div className="h-[1px] w-full bg-app-gray-200 dark:bg-app-gray-600"></div>
        </div>
      )}
      {children}
      {showInput && (
        <>
          <TextField {...inputProps} pill={pill} />
          <Button
            className="my-4"
            {...inputBtnProps}
            variant={!isExistingLogin && primaryBtn === "input" ? "primary" : "tertiary"}
            block
            onClick={onInputBtnClick}
          >
            {inputBtnLabel}
          </Button>
        </>
      )}
    </div>
  );
};

export { LoginForm };