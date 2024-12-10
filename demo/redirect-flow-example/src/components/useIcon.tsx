import { useContext, createContext, ReactNode } from "react";

interface IconSets {
  [key: string]: React.ComponentType | (() => Promise<{ default: React.ComponentType }>);
}

const IconContext = createContext<IconSets | undefined>(undefined);

export const getIconName = (name: string): string => {
  return name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
};

interface IconsProviderProps {
  children: ReactNode;
  customIcons?: IconSets;
}

export const IconsProvider: React.FC<IconsProviderProps> = ({ children, customIcons = {} }) => {
  const icons: IconSets = {};

  Object.entries(customIcons).forEach(([key, value]) => {
    icons[getIconName(key)] = value;
  });

  return <IconContext.Provider value={icons}>{children}</IconContext.Provider>;
};

export const useIcons = () => {
  const icons = useContext(IconContext);

  function getIcon(name: string) {
    const iconName = getIconName(name);
    if (!icons || !icons[iconName]) {
      console.error(`Missing Icon name given: ${iconName}`);
      return null;
    }
    return icons[iconName];
  }

  return { getIcon };
};