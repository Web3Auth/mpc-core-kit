import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./Card";

const loaderVariants = cva(
  `flex-col items-center justify-center relative inline-flex`,
  {
    variants: {
      size: {
        sm: "w-6 h-6",
        default: "h-[60px] w-[60px]",
        md: "w-10 h-10",
        lg: "w-16 h-16",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export interface LoaderProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loaderVariants> {
  showLogo?: boolean;
  logoClass?: string;
  text?: string;
  textClass?: string;
  containerClass?: string;
  loaderClass?: string;
}

const Loader = React.forwardRef<HTMLDivElement, LoaderProps>(
  (
    {
      className,
      size,
      showLogo = false,
      text = "",
      logoClass,
      textClass,
      containerClass,
      loaderClass,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center flex-1 gap-4",
          containerClass,
        )}
      >
        <div
          ref={ref}
          className={cn(loaderVariants({ className, size }))}
          {...props}
        >
          <div className={cn("loader-spinner", loaderClass)}></div>
          {showLogo && (
            <div
              className={cn(
                "absolute overflow-hidden top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
                logoClass,
              )}
            >
              <img
                src="https://assets.web3pay.io/images/web3auth_dark.svg"
                alt="Web3auth Logo"
                aria-label="Web3auth Logo Dark"
                width={200}
                height={35}
                className="hidden dark:flex"
              />
              <img
                src="https://assets.web3pay.io/images/logo_loading.svg"
                alt="Web3auth Logo"
                aria-label="Web3auth Logo Light"
                width={200}
                height={35}
                className="flex dark:hidden"
              />
            </div>
          )}
        </div>
        {text && (
          <p
            className={cn(
              "text-center text-lg font-normal text-app-gray-900 dark:text-app-white",
              textClass,
            )}
          >
            {text || "Loading..."}
          </p>
        )}
      </div>
    );
  },
);

Loader.displayName = "Loader";

export { loaderVariants };
export default Loader;