import type { ReactNode } from "react";

import { createContext, useContext, useState } from "react";

export const colors = {
  blue: "#121B44",
  green: "#63D77D",
  rain: "#9EA2B8",
  red: "#FC5555",
  sky: "#405AE5",
  white: "#FFFFFF",
};

export type ColorName = keyof typeof colors;

export type Theme = {
  name: string;
  colors: {
    accent: ColorName;
    accentContent: ColorName;
    secondary: ColorName;
    secondaryContent: ColorName;
    content: ColorName;
    contentAlt: ColorName;
    negative: ColorName;
    negativeContent: ColorName;
    positive: ColorName;
    positiveContent: ColorName;
  };
};

export const theme: Theme = {
  name: "light",
  colors: {
    accent: "sky",
    accentContent: "white",
    secondary: "blue",
    secondaryContent: "white",
    content: "blue",
    contentAlt: "white",
    negative: "red",
    negativeContent: "white",
    positive: "green",
    positiveContent: "white",
  },
};

export function themeColor(theme: Theme, name: keyof Theme["colors"]) {
  return colors[theme.colors[name]];
}

const ThemeContext = createContext({
  theme,
  setTheme: (_: Theme) => {},
});

export function useTheme() {
  const { theme, setTheme } = useContext(ThemeContext);
  return {
    theme,
    setTheme,
    color: (name: keyof Theme["colors"]) => (
      colors[theme.colors[name]]
    ),
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setTheme] = useState<Theme>(theme);
  return (
    <ThemeContext.Provider value={{ theme: currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
