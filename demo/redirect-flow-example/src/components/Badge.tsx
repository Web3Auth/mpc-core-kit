import * as React from "react";
import { cn } from "./Card";

interface BadgeProps {
  size?: "small" | "large";
  variant?: "default" | "primary" | "success" | "danger" | "warning" | "info";
  pill?: boolean;
  border?: boolean;
  clearIcon?: boolean;
  id?: string;
  classes?: {
    container?: string;
    clearIcon?: string;
  };
  component?: React.ElementType;
  onClear?: () => void;
  children?: React.ReactNode;
}

const Badge: React.FC<BadgeProps> = ({
  size = "small",
  variant = "default",
  pill = false,
  border = false,
  clearIcon = false,
  id = "",
  classes = {},
  component: Component = "span",
  onClear,
  children,
}) => {
  const sizeClasses = size === "large" ? "py-0.5 px-3 text-xs leading-4 h-6" : "py-0.5 px-2.5 text-xs leading-4 h-5";
  const variantClasses = {
    default: "bg-app-gray-100 text-app-gray-900 dark:bg-app-gray-700 dark:text-app-gray-300",
    primary: "bg-app-primary-100 text-app-primary-800 dark:bg-app-primary-900 dark:text-app-primary-400",
    success: "bg-app-green-100 text-app-green-800 dark:bg-app-gray-700 dark:text-app-green-400",
    danger: "bg-app-red-100 text-app-red-800 dark:bg-app-gray-700 dark:text-app-red-400",
    warning: "bg-app-yellow-100 text-app-yellow-800 dark:bg-app-gray-700 dark:text-app-yellow-300",
    info: "bg-app-primary-100 text-app-primary-800 dark:bg-app-primary-900 dark:text-app-primary-400",
  }[variant];
  const borderClasses = border ? `border ${variantClasses.split(" ")[1]}-border` : "";

  return (
    <Component
      id={id}
      className={cn(
        "inline-flex items-center font-medium",
        sizeClasses,
        variantClasses,
        pill ? "rounded-full" : "rounded-md",
        borderClasses,
        classes.container
      )}
      role="status"
    >
      {children}
      {clearIcon && (
        <button
          type="button"
          className={cn(
            "inline-flex items-center p-0.5 ml-2 text-sm bg-app-transparent rounded-sm",
            classes.clearIcon
          )}
          data-dismiss-target={`#${id || `badge-dismiss-${variant}`}`}
          aria-label="Remove"
          onClick={onClear}
        >
          <span className="sr-only">Remove badge</span>
          <svg
            className="w-[15px]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </Component>
  );
};

export default Badge;