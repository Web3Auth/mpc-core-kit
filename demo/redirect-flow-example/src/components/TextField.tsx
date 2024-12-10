import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "./Card";
import { HiOutlineExclamationCircle } from "react-icons/hi";

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: "small" | "medium" | "large";
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

const TextField: React.FC<TextFieldProps> = ({
  inputSize = "medium",
  label = "",
  placeholder = "",
  value = "",
  type = "text",
  disabled = false,
  id = "",
  error = false,
  success = false,
  helperText = "",
  pill = false,
  toolTipIcon = "information-circle-icon",
  showToolTipIcon = false,
  trailingIcon = "",
  endIcon = "",
  classes = {},
  onTrailingIconClick,
  onEndIconClick,
  onTooltipClick,
  ...props
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  const classList = useMemo(() => {
    return {
      container: cn("relative w-full items-stretch", classes.container),
      label: cn(
        "label",
        success && !disabled ? "success-label" : error && !disabled ? "error-label" : "default-label",
        classes.label
      ),
      inputContainer: cn(
        "relative flex items-center",
        success ? "success-container" : error ? "error-container" : "default-container",
        pill ? "rounded-full" : "rounded-lg",
        `size-${inputSize}`,
        isFocused ? (success ? "success-container-focus" : error ? "error-container-focus" : "default-container-focus") : "",
        disabled && (classes.disabled || "disabled-input"),
        classes.inputContainer
      ),
      input: cn(
        `size-input-${inputSize}`,
        pill ? "rounded-full" : "rounded-lg",
        success ? "success-input" : error ? "error-input" : "default-input",
        "input-root",
        disabled && (classes.disabled || "disabled-input"),
        classes.input
      ),
      helperText: cn(
        "text-xs font-normal mt-1",
        success && !disabled ? "success-msg" : error && !disabled ? "error-msg" : "default-msg",
        classes.helperText
      ),
      trailingIcon: cn("icon mr-2 cursor-pointer", classes.trailingIcon),
      endIcon: cn("icon ml-2 cursor-pointer", classes.endIcon),
      toolTipIcon: cn("ml-1 cursor-pointer w-[15px]", classes.toolTipIcon),
    };
  }, [success, error, disabled, pill, inputSize, isFocused, classes]);

  return (
    <div className={classList.container}>
      {label && (
        <label htmlFor={id} className={classList.label}>
          {label}
          {showToolTipIcon && !props.children && (
            <HiOutlineExclamationCircle name={toolTipIcon} size="15" className={classList.toolTipIcon} onClick={onTooltipClick} />
          )}
          {showToolTipIcon && props.children}
        </label>
      )}
      <div className={classList.inputContainer}>
        {trailingIcon && !props.children && (
          <HiOutlineExclamationCircle name={trailingIcon} className={classList.trailingIcon} onClick={onTrailingIconClick} />
        )}
        {props.children}
        <input
          id={id}
          value={inputValue}
          type={type}
          placeholder={placeholder}
          aria-placeholder={placeholder || "TextField Placeholder"}
          aria-labelledby={label || "TextField Label"}
          disabled={disabled}
          className={classList.input}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => setInputValue(e.target.value)}
          {...props}
        />
        {endIcon && !props.children && (
          <></>
          // <Icon name={endIcon} className={classList.endIcon} onClick={onEndIconClick} />
        )}
        {props.children}
      </div>
      {helperText && <p className={classList.helperText}>{helperText}</p>}
    </div>
  );
};

TextField.displayName = "TextField";

export { TextField };