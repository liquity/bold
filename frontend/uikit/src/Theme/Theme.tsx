"use client";

import type { ReactNode } from "react";

import { createContext, useContext, useState } from "react";

// The Liquity V2 base color palette, meant
// to be used by themes rather than directly.
export const colors = {
  white: "#FFFFFF",
  black: "#000000",

  neutral100: "#353945",
  neutral200: "#23262F",
  neutral300: "#141416",

  neutralDimmed100: "#35394580",
  neutralDimmed200: "#23262F80",
  neutralDimmed300: "#14141680",

  gray100: "#D7D7D7",
  gray200: "#C8C8C8",
  gray300: "#AFAFAF",
  gray400: "#969696",
  gray500: "#737373",
  gray600: "#555555",

  // PlaceHolder
  green: "#7AFB79",
  yellow: "#DFFF1C",
  blue: "#87C1F8",
  red: "#F36740",

  // Brand
  gold: "#E49D2F",
  goldLight: "#F6AE3F"
};

// The dark theme, which is the only theme for now. These
// colors are meant to be used by components via useTheme(),
// so that the theme can be changed at runtime.

// Some notes about naming conventions:
// - "xContent" is the color used over a "x" background (text, icons or outlines).
// - "xHint" is the color used to hint that "x" is interactive (generally on hover).
// - "xActive" is the color used to indicate that "x" is being interacted with (generally on press).
// - "xSurface" is the color used for the surface of "x" (generally the background).
export const darkTheme = {
  name: "dark" as const,
  colors: {
    accent: "gold",
    accentActive: "goldLight",
    accentContent: "gold",
    accentHint: "blue",
    background: "black",
    backgroundActive: "gray500",
    border: "gray500",
    borderSoft: "gray500",
    content: "white",
    contentAlt: "gray300",
    contentAlt2: "gray500",
    controlBorder: "gray500",
    controlBorderStrong: "blue",
    controlSurface: "neutral300",
    controlSurfaceAlt: "neutralDimmed200",
    hint: "blue",
    infoSurface: "neutralDimmed100",
    infoSurfaceBorder: "yellow",
    infoSurfaceContent: "yellow",
    dimmed: "gray100",
    fieldBorder: "neutral100",
    fieldBorderFocused: "neutral200",
    fieldSurface: "neutralDimmed100",
    focused: "blue",
    focusedSurface: "neutral100",
    focusedSurfaceActive: "green",
    strongSurface: "blue",
    strongSurfaceContent: "red",
    strongSurfaceContentAlt: "blue",
    strongSurfaceContentAlt2: "green",
    position: "green",
    positionContent: "white",
    positionContentAlt: "gray100",
    interactive: "white",
    negative: "red",
    negativeStrong: "red",
    negativeActive: "red",
    negativeContent: "white",
    negativeHint: "red",
    negativeSurface: "red",
    negativeSurfaceBorder: "red",
    negativeSurfaceContent: "red",
    negativeSurfaceContentAlt: "red",
    negativeInfoSurface: "red",
    negativeInfoSurfaceBorder: "red",
    negativeInfoSurfaceContent: "red",
    negativeInfoSurfaceContentAlt: "gray100",
    positive: "green",
    positiveAlt: "green",
    positiveActive: "green",
    positiveContent: "white",
    positiveHint: "green",
    secondary: "blue",
    secondaryActive: "blue",
    secondaryContent: "blue",
    secondaryHint: "blue",
    selected: "gold",
    separator: "gray100",
    surface: "white",
    tableBorder: "gray100",
    warning: "yellow",
    warningAlt: "yellow",
    disabledBorder: "gray100",
    disabledContent: "white",
    disabledSurface: "gray100",
    brandBlue: "blue",
    brandBlueContent: "white",
    brandBlueContentAlt: "blue",
    brandDarkBlue: "blue",
    brandDarkBlueContent: "white",
    brandDarkBlueContentAlt: "gray100",
    brandLightBlue: "blue",
    brandGolden: "gold",
    brandGoldenContent: "yellow",
    brandGoldenContentAlt: "yellow",
    brandGreen: "green",
    brandGreenContent: "green",
    brandGreenContentAlt: "green",

    // colors are resolved so we can animate them
    riskGradient1: "#63D77D", // green:400
    riskGradient2: "#B8E549",
    riskGradient3: "#F1C91E", // yellow:400
    riskGradient4: "#FFA12B",
    riskGradient5: "#FB7C59", // red:400

    riskGradientDimmed1: "red",
    riskGradientDimmed2: "yellow",
    riskGradientDimmed3: "green",

    loadingGradient1: "blue",
    loadingGradient2: "blue",
    loadingGradientContent: "blue",

  } satisfies Record<string, (keyof typeof colors) | `#${string}`>,
} as const;

export type ThemeDescriptor = {
  name: "dark"; // will be "light" | "dark"
  colors: typeof darkTheme.colors; // darkTheme acts as a reference for types
};
export type ThemeColorName = keyof ThemeDescriptor["colors"];

export function themeColor(theme: ThemeDescriptor, name: ThemeColorName) {
  const themeColor = theme.colors[name];

  if (themeColor.startsWith("#")) {
    return themeColor;
  }

  if (themeColor in colors) {
    return colors[themeColor as keyof typeof colors];
  }

  throw new Error(`Color ${themeColor} not found in theme`);
}

const ThemeContext = createContext({
  theme: darkTheme,
  setTheme: (_: ThemeDescriptor) => { },
});

export function useTheme() {
  const { theme, setTheme } = useContext(ThemeContext);
  return {
    color: (name: ThemeColorName) => themeColor(theme, name),
    setTheme,
    theme,
  };
}

export function Theme({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<ThemeDescriptor>(darkTheme);
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
