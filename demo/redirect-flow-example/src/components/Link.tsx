import * as React from "react";
import { cn } from "./Card";

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  target?: string;
  classes?: Partial<Record<string, string>>;
  disabled?: boolean;
}

const Link: React.FC<LinkProps> = ({
  href = "",
  target = "",
  classes = {},
  disabled = false,
  children,
  ...props
}) => {
  const classList = React.useMemo(() => {
    let textClass = "";
    let hoverClass = "";
    if (disabled) {
      textClass = "text-app-gray-400";
      hoverClass = "hover:cursor-not-allowed";
    } else {
      textClass = "text-app-blue-600";
      hoverClass = "hover:underline hover:cursor-pointer";
    }

    return cn(textClass, hoverClass, classes.root);
  }, [disabled, classes]);

  const linkProps: React.AnchorHTMLAttributes<HTMLAnchorElement> = {
    className: classList,
    ...props,
  };

  if (disabled) {
    linkProps["aria-disabled"] = "true";
    linkProps.role = "link";
  }
  if (href && !disabled) linkProps.href = href;
  if (target) linkProps.target = target;
  if (target === "_blank") linkProps.rel = "noreferrer noopener";

  return (
    <a {...linkProps}>
      {children}
    </a>
  );
};

Link.displayName = "Link";

export { Link };