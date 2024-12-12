import * as React from "react";
import { useState, useEffect } from "react";
import { cn } from "./Card";

export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  modelValue?: boolean;
  size?: "small" | "medium" | "large";
  labelEnabled?: string;
  labelDisabled?: string;
  showLabel?: boolean;
  disabled?: boolean;
  onToggleChange?: (value: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({
  modelValue = false,
  size = "large",
  labelEnabled = "",
  labelDisabled = "",
  showLabel = false,
  disabled = false,
  onToggleChange,
  ...props
}) => {
  const [checked, setChecked] = useState(modelValue);

  useEffect(() => {
    setChecked(modelValue);
  }, [modelValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setChecked(value);
    if (onToggleChange) {
      onToggleChange(value);
    }
  };

  return (
    <div className={cn("flex items-center", { "cursor-pointer": !disabled })}>
      {size === "small" ? (
        <>
          <label
            className={cn("switch rounded-full", {
              "bg-app-success": checked,
              "bg-app-gray-400": !checked,
              "mr-2": showLabel,
              "!cursor-not-allowed !bg-app-gray-200": disabled,
            })}
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={checked}
              disabled={disabled}
              onChange={handleChange}
              {...props}
            />
            <div className={cn("knob w-3 h-3 bg-app-white rounded-full", { "float-right": checked })}></div>
          </label>
          {showLabel && (
            <div className="text-base text-app-gray-600 dark:text-app-gray-100">
              <span>{checked ? labelEnabled || "Enabled" : labelDisabled || "Disabled"}</span>
            </div>
          )}
        </>
      ) : (
        <label
          className={cn("toggle cursor-pointer", size, { "!cursor-not-allowed": disabled })}
          style={{ width: "300px" }}
        >
          <input
            type="checkbox"
            className="sr-only peer"
            checked={checked}
            disabled={disabled}
            onChange={handleChange}
            {...props}
          />
          <div className={cn("toggle-tab", { selected: checked, unselected: !checked })}>
            {labelEnabled || "Select"}
          </div>
          <div className={cn("toggle-tab", { selected: !checked, unselected: checked })}>
            {labelDisabled || "Unselect"}
          </div>
        </label>
      )}
    </div>
  );
};

Toggle.displayName = "Toggle";

export { Toggle };