
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./Card";
import Loader from "./Loader";

const buttonVariants = cva(
  `flex items-center justify-center ease-linear transition-all duration-150`,
  {
    variants: {
      size: {
        xs: "h-8 px-3 py-2 text-xs",
        sm: "h-9 px-3 py-2 text-sm",
        md: "h-10 px-5 py-2.5 text-sm",
        lg: "h-12 px-5 py-3 text-base",
        xl: "h-13 px-6 py-3.5 text-base",
        icon: "h-10 w-10 rounded-full flex items-center justify-center",
      },
      variant: {
        primary: `bg-app-primary-600 text-app-onPrimary hover:bg-app-primary-700 active:bg-app-primary-600 active:outline active:outline-offset-1 active:outline-1 active:outline-app-primary-600 focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-1 focus-visible:outline-app-primary-600 dark:bg-app-primary-500 dark:hover:bg-app-primary-400 dark:active:bg-app-primary-500 dark:active:outline-app-primary-500 dark:focus-visible:outline-app-primary-500`,
        secondary: `bg-transparent text-app-gray-500 border border-app-gray-500 hover:bg-app-gray-200 active:bg-transparent active:border-app-primary-600 active:ring-1 active:ring-app-primary-600 focus-visible:border-app-primary-600 focus-visible:bg-transparent focus-visible:ring-1 focus-visible:ring-app-primary-600 dark:text-app-white dark:border-app-gray-300 dark:hover:bg-app-gray-700 dark:active:bg-transparent dark:active:border-app-primary-500 dark:active:ring-app-primary-500 dark:focus-visible:border-app-primary-500 dark:focus-visible:bg-transparent dark:focus-visible:ring-app-primary-500`,
        tertiary: `bg-app-gray-200 text-app-gray-800 hover:bg-app-gray-300 active:bg-app-gray-200 active:ring-2 active:ring-app-primary-600 focus-visible:ring-2 focus-visible:ring-app-primary-600 dark:bg-app-gray-500 dark:text-app-white dark:hover:bg-app-gray-400 dark:active:bg-app-gray-500 dark:active:ring-app-primary-500 dark:focus-visible:ring-app-primary-500`,
        text: `text-app-primary-600 hover:text-app-primary-800 hover:underline active:text-app-primary-600 active:ring-2 active:ring-app-primary-600 focus-visible:ring-2 focus-visible:ring-app-primary-600 disabled:text-app-gray-400 disabled:no-underline dark:text-app-primary-500 dark:hover:text-app-primary-400 dark:disabled:text-app-gray-600`,
      },
      rounded: {
        true: "rounded-full",
        false: "rounded-md",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "primary",
      rounded: false,
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
  loading?: boolean;
  href?: string;
  loadingWithText?: boolean;
  classes?: Partial<Record<string, string>>;
}

const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      className,
      size,
      variant,
      block,
      rounded,
      loading = false,
      loadingWithText = false,
      children,
      href,
      classes = {},
      ...props
    },
    ref
  ) => {
    const Component = href ? "a" : "button";

    return (
      <Component
        href={href}
        className={cn(
          buttonVariants({ size, variant, block, rounded }),
          className,
          {
            "cursor-not-allowed": props.disabled,
            "btn-link": href,
          }
        )}
        ref={ref as React.Ref<HTMLButtonElement & HTMLAnchorElement>}
        role={href ? "link" : "button"}
        disabled={loading || props.disabled || loadingWithText}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement> & React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {(loading || loadingWithText) && (
          <span
            className={cn(
              "loading loading-spinner w-5 h-5",
              { "mr-2": !loading },
              classes.loader
            )}
          />
        )}
        {loading && <Loader size={"sm"} containerClass="flex-none" />}
        {!loading && children}
      </Component>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };