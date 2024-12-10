import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
/** Merge classes with tailwind-merge with clsx full feature */
import { twMerge } from "tailwind-merge";
import clsx, { ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
  
const cardVariants = cva(
  `max-w-[400px] h-full relative bg-app-white border border-solid border-app-gray-200 dark:border-app-gray-800 rounded-md shadow-md dark:bg-app-gray-800 dark:shadow-dark`,
  {
    variants: {
      border: {
        true: "border",
        false: "!border-0",
      },
      rounded: {
        true: "rounded-md",
        false: "!rounded-none",
      },
      shadow: {
        true: "shadow-md",
        false: "!shadow-none",
      },
    },
    defaultVariants: {
      border: true,
      rounded: true,
      shadow: true,
    },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  children: React.ReactNode;
  height?: string;
  classes?: Partial<Record<string, string>>;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, border, rounded, shadow, children, height = "inherit", classes = {}, ...props }, ref) => {
    const hasFooterSlot = React.Children.toArray(children).some(
      (child: any) => child?.props?.slot === "footer",
    );

    return (
      <div
        className={cn(cardVariants({ border, rounded, shadow }), classes.container, className)}
        style={{ height }}
        ref={ref}
        {...props}
      >
        {children}
        {hasFooterSlot && (
          <div className="absolute bottom-0 w-[calc(100%-48px)] footer">
            {React.Children.map(children, (child: any) =>
              child?.props?.slot === "footer" ? child : null,
            )}
          </div>
        )}
      </div>
    );
  },
);

Card.displayName = "Card";

export { Card, cardVariants };