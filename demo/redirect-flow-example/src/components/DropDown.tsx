import React, { useState, useEffect, useRef } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { HiCheckCircle } from "react-icons/hi2";
import { MdOutlineRadioButtonChecked, MdOutlineRadioButtonUnchecked } from "react-icons/md";
import { cn } from "./Card";

interface Option {
  name: string;
  value: string;
  icon?: React.ReactNode;
  endSlot?: React.ReactNode;
  startSlot?: React.ReactNode;
}

export interface DropdownProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "options" | "defaultValue" | "onChange"
  > {
  value?: string | string[];
  options: Option[];
  defaultValue?: string | string[];
  placeholder?: string;
  onChange?: (value: string[] | string) => void;
  pill?: boolean;
  inputSize?: "sm" | "md" | "lg";
  showArrow?: boolean;
  EndSlot?: React.ReactNode;
  StartSlot?: React.ReactNode;
  showSelectHint?: boolean;
  multiple?: boolean;
  showValue?: boolean;
  classes?: {
    container?: string;
    inputContainer?: string;
    placeholder?: string;
    inputIcon?: string;
    input?: string;
    optionContainer?: string;
    optionItem?: string;
    optionIcon?: string;
    optionEndSlot?: string;
    optionStartSlot?: string;
    startSlot?: string;
    endSlot?: string;
    arrow?: string;
  };
}

const Dropdown = React.forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      value,
      className,
      options,
      defaultValue,
      placeholder = "Select...",
      onChange,
      pill = true,
      inputSize = "md",
      classes,
      showArrow = true,
      StartSlot,
      EndSlot,
      showSelectHint = true,
      multiple = false,
      showValue = true,
      ...props
    },
    ref,
  ) => {
    const initialSelectedOptions = Array.isArray(defaultValue)
      ? options.filter((option) => defaultValue.includes(option.value))
      : options.filter((option) => option.value === defaultValue);

    const [isOpen, setIsOpen] = useState(false);
    const [selectedOption, setSelectedOptions] = useState<Option[]>(
      initialSelectedOptions,
    );
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const [isFocused, setIsFocused] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    useEffect(() => {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => {
        document.removeEventListener("mousedown", handleOutsideClick);
      };
    }, []);

    const handleOptionClick = (option: Option) => {
      if (multiple) {
        setSelectedOptions((prev) => {
          if (prev.find((item) => item.value === option.value)) {
            return prev.filter((item) => item.value !== option.value);
          }
          if (onChange)
            onChange([...prev, option].map((option) => option.value));
          return [...prev, option];
        });
      } else {
        setSelectedOptions([option]);
        if (onChange) onChange(option.value);
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (!isFocused) return;

      if (isOpen) {
        if (event.key === "ArrowDown") {
          setHighlightedIndex((prevIndex) => (prevIndex + 1) % options.length);
        } else if (event.key === "ArrowUp") {
          setHighlightedIndex(
            (prevIndex) => (prevIndex - 1 + options.length) % options.length,
          );
        } else if (event.key === "Enter") {
          handleOptionClick(options[highlightedIndex]);
        }
      } else if (event.key === "Tab" || event.key === "Enter") {
        setIsOpen(true);
      }
    };

    const renderSelectedOptions = () => {
      if (multiple) {
        if (selectedOption.length > 2) {
          return (
            <p className="flex items-center">
              <span className="mr-1">{selectedOption[0].name},</span>
              <span className="mr-1">{selectedOption[1].name}</span>
              <span className="mr-1">+{selectedOption.length - 2}</span>
            </p>
          );
        } else {
          return selectedOption.map((option) => (
            <span key={option.value} className="mr-1">
              {option.name}
            </span>
          ));
        }
      } else {
        return selectedOption[0]?.name;
      }
    };

    const isSelected = (option: Option) => {
      return multiple
        ? selectedOption.find((item) => item.value === option.value)
        : selectedOption?.[0]?.value === option.value;
    };

    useEffect(() => {
      if (!value) return;

      const selectedValues: Option[] = [];
      if (Array.isArray(value)) {
        selectedValues.push(...options.filter((o) => value.includes(o.value)));
      } else {
        selectedValues.push(...options.filter((o) => o.value === value));
      }
      setSelectedOptions(selectedValues);
    }, [options, value]);

    return (
      <div
        className={cn("relative w-full", classes?.container)}
        ref={dropdownRef}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      >
        <div
          ref={ref}
          tabIndex={0}
          className={cn(
            `flex items-center justify-between p-2 bg-app-white dark:bg-app-gray-800 cursor-pointer w-full rounded-2xl py-2 px-5 h-10 outline-none focus:outline-none focus:ring-0`,
            {
              "rounded-full": pill,
              "h-8 py-2": inputSize === "sm",
              "h-12 py-3.5": inputSize === "lg",
            },
            classes?.inputContainer,
          )}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
        >
          {selectedOption ? (
            <div
              className={cn(
                "flex items-center gap-x-2 text-sm font-normal text-app-gray-900 dark:text-app-white",
                classes?.input,
              )}
            >
              {!multiple && selectedOption?.[0]?.icon && (
                <span
                  className={cn(
                    "text-base font-normal h-5 w-5",
                    classes?.inputIcon,
                  )}
                >
                  {selectedOption?.[0]?.icon}
                </span>
              )}
              {StartSlot && (
                <div className={cn(classes?.startSlot)}>{StartSlot}</div>
              )}
              {showValue && renderSelectedOptions()}
            </div>
          ) : (
            <span
              className={cn(
                "text-app-gray-400 text-sm font-normal",
                classes?.placeholder,
              )}
            >
              {placeholder}
            </span>
          )}
          <div className="flex items-center justify-end gap-x-1 ml-2">
            {EndSlot && (
              <div className={cn(classes?.endSlot, "mx-2")}>{EndSlot}</div>
            )}
            {showArrow && (
              <span>
                {isOpen ? (
                  <FaChevronUp
                    className={cn(
                      "text-app-gray-400 text-sm font-medium",
                      classes?.arrow,
                    )}
                  />
                ) : (
                  <FaChevronDown
                    className={cn(
                      "text-app-gray-400 text-sm font-medium",
                      classes?.arrow,
                    )}
                  />
                )}
              </span>
            )}
          </div>
        </div>
        {isOpen && (
          <ul
            className={cn(
              "absolute left-0 w-max mt-2 overflow-auto bg-app-white dark:bg-app-gray-900 dark:border-gray-700 border rounded-lg shadow max-h-60 transition-all duration-300 ease-in-out transform origin-top scale-y-100 opacity-100 z-20 py-1",
              classes?.optionContainer,
            )}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                className={cn(
                  `flex items-center justify-between py-2 px-4 cursor-pointer gap-x-6 text-sm text-app-gray-500 dark:text-app-gray-400`,
                  {
                    "text-app-gray-900 dark:text-app-white":
                      index === highlightedIndex || isSelected(option),
                  },
                  classes?.optionItem,
                )}
                onClick={() => handleOptionClick(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex items-center gap-x-2">
                  {option.startSlot && (
                    <div className={cn(classes?.optionStartSlot)}>
                      {option.startSlot}
                    </div>
                  )}
                  {option.icon && (
                    <div className={cn("h-5 w-5", classes?.optionIcon)}>
                      {option.icon}
                    </div>
                  )}
                  <p>{option.name}</p>
                </div>
                <div className="flex items-center gap-x-2">
                  {option.endSlot && (
                    <div className={cn(classes?.optionEndSlot)}>
                      {option.endSlot}
                    </div>
                  )}
                  {showSelectHint && (
                    <div>
                      {isSelected(option) ? (
                        multiple ? (
                          <HiCheckCircle className="text-xl font-bold text-app-primary-600 dark:text-app-primary-500" />
                        ) : (
                          <MdOutlineRadioButtonChecked className="text-app-primary-600 dark:text-app-primary-500 text-xl font-bold" />
                        )
                      ) : (
                        <MdOutlineRadioButtonUnchecked className="text-app-gray-400 dark:text-app-gray-500 text-xl font-bold" />
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

Dropdown.displayName = "Dropdown";

export { Dropdown };