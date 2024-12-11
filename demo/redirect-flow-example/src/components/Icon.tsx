import * as React from "react";
import { useEffect, useState } from "react";
import { useIcons } from "./useIcon";

const isPromise = (value: unknown): value is Promise<unknown> => {
  return Boolean(value && typeof (value as Promise<unknown>).then === "function");
};

export interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: string | number;
  className?: string;
  name: string;
}

const Icon: React.FC<IconProps> = ({ size = "20", className = "", name, ...props }) => {
  const [icon, setIcon] = useState<React.ComponentType | null>(null);
  const { getIcon } = useIcons();

  useEffect(() => {
    const setIconValue = async () => {
      const icon = getIcon(name);
      let updatedIcon: React.ComponentType | Promise<{ default: React.ComponentType }> | (() => Promise<{ default: React.ComponentType }>) | null = icon;
      if (typeof icon === "function" && icon.prototype == null) {
        updatedIcon = (icon as () => Promise<{ default: React.ComponentType }>)();
      }
      if (isPromise(updatedIcon)) {
        const resolvedIcon = (await updatedIcon).default;
        setIcon(() => resolvedIcon);
      } else {
        setIcon(() => updatedIcon as React.ComponentType | null);
      }
    };

    setIconValue();
  }, [name, getIcon]);

  const classList = typeof className === "string" ? [className, "w-5"].join(" ") : [className, "w-5"].join(" ");

  if (!icon) return null;

  return React.createElement(icon as React.ComponentType<React.HTMLAttributes<HTMLElement>>, {
    style: { width: size, height: size },
    className: classList,
    ...props,
  });
};

Icon.displayName = "Icon";

export { Icon };