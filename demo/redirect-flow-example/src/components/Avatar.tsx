import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./Card";

const avatarVariants = cva(
  `relative inline-flex items-center justify-center overflow-hidden bg-app-gray-100 dark:bg-app-gray-600`,
  {
    variants: {
      size: {
        xs: "w-6 h-6",
        sm: "w-8 h-8",
        md: "w-10 h-10",
        lg: "w-14 h-14",
        xl: "w-20 h-20",
      },
      rounded: {
        true: "rounded-full",
        false: "rounded-lg",
      },
      border: {
        true: "p-1 ring-2 ring-app-gray-300 dark:ring-app-gray-500",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      rounded: true,
      border: false,
    },
  },
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  children: React.ReactNode;
  id?: string;
  classes?: Partial<Record<string, string>>;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, rounded, border, children, id, classes = {}, ...props }, ref) => {
    return (
      <div
        id={id}
        role="button"
        className={cn(avatarVariants({ size, rounded, border }), classes.container, className)}
        aria-hidden
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Avatar.displayName = "Avatar";

export { Avatar, avatarVariants };