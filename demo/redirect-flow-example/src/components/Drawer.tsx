import * as React from "react";
import { cn } from "./Card";
import { cva } from "class-variance-authority";
import { HiX } from "react-icons/hi";

const drawerVariants = cva(
  `fixed z-40 h-screen overflow-y-auto bg-app-white dark:bg-app-gray-800 transition-transform top-0`,
  {
    variants: {
      placement: {
        left: "left-0",
        right: "right-0",
      },
    },
    defaultVariants: {
      placement: "left",
    },
  }
);

export interface DrawerProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  sidebarCloseIcon?: boolean;
  backdropCloseIcon?: boolean;
  placement?: "left" | "right";
  backdropClose?: boolean;
  id?: string;
  classes?: Partial<Record<string, string>>;
  onClose?: () => void;
}

const Drawer: React.FC<DrawerProps> = ({
  open = false,
  sidebarCloseIcon = true,
  backdropCloseIcon = true,
  placement = "left",
  backdropClose = true,
  id = "",
  classes = {},
  onClose,
  children,
  ...props
}) => {
  if (!open) return null;

  return (
    <>
      <div
        id={id}
        className={cn("drawer-sidebar", drawerVariants({ placement }), classes.container)}
        tabIndex={-1}
        aria-labelledby="drawer-label"
        {...props}
      >
        {sidebarCloseIcon && (
          <button
            type="button"
            data-drawer-hide="drawer-close"
            aria-controls="drawer-close"
            className={cn("absolute top-2.5 close-btn right-2.5", classes.sidebarCloseBtn)}
            onClick={onClose}
            onKeyDown={(e) => e.key === "Escape" && onClose && onClose()}
          >
            <HiX className="w-5 h-5" height={20} width={20} />
            <span className="sr-only">Close menu</span>
          </button>
        )}
        {children}
      </div>
      <div
        aria-hidden
        data-drawer-backdrop={backdropClose}
        className={cn("backdrop-container", classes.backdropContainer)}
        onClick={backdropClose ? onClose : undefined}
      >
        {backdropCloseIcon && (
          <button
            type="button"
            data-drawer-hide="drawer-close"
            aria-controls="drawer-close"
            className={cn(
              "close-btn !text-app-white hover:!bg-transparent dark:hover:!bg-transparent !top-1.5",
              { "right-1.5": placement === "left", "left-1.5": placement === "right" },
              classes.backdropCloseBtn
            )}
            onClick={onClose}
            onKeyDown={(e) => e.key === "Escape" && onClose && onClose()}
          >
            <HiX className="w-6 h-6" height={24} width={24} />
            <span className="sr-only">Close menu</span>
          </button>
        )}
      </div>
    </>
  );
};

Drawer.displayName = "Drawer";

export { Drawer, drawerVariants };