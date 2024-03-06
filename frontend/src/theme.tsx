"use client";

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
    content: ColorName;
    contentAlt: ColorName;
    negative: ColorName;
    positive: ColorName;
  };
};

export const theme: Theme = {
  name: "light",
  colors: {
    accent: "sky",
    content: "blue",
    contentAlt: "white",
    negative: "red",
    positive: "green",
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
