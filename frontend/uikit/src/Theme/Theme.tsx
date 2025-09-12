"use client";

import type { ReactNode } from "react";

import { createContext, useContext, useState } from "react";

// The Liquity V2 base color palette, meant
// to be used by themes rather than directly.
export const colors = {
  // Blue
  "blue:50": "#F0F3FE",
  "blue:100": "#DEE4FB",
  "blue:200": "#C4D0F9",
  "blue:300": "#9CB1F4",
  "blue:400": "#6D8AED",
  "blue:500": "#405AE5",
  "blue:600": "#3544DB",
  "blue:700": "#2D33C8",
  "blue:800": "#2A2BA3",
  "blue:900": "#272A81",
  "blue:950": "#1C1D4F",

  // Gray
  "gray:50": "#F5F6F8",
  "gray:100": "#EDEFF2",
  "gray:200": "#DDE0E8",
  "gray:300": "#C8CDD9",
  "gray:400": "#B1B7C8",
  "gray:500": "#9EA2B8",
  "gray:600": "#878AA4",
  "gray:700": "#73748F",
  "gray:800": "#5F6174",
  "gray:900": "#50525F",
  "gray:950": "#2F3037",

  // Yellow
  "yellow:50": "#FDFBE9",
  "yellow:100": "#FCF8C5",
  "yellow:200": "#FAEE8E",
  "yellow:300": "#F5D93A",
  "yellow:400": "#F1C91E",
  "yellow:500": "#E1B111",
  "yellow:600": "#C2890C",
  "yellow:700": "#9B620D",
  "yellow:800": "#804E13",
  "yellow:900": "#6D4016",
  "yellow:950": "#402108",

  // Green
  "green:50": "#F1FCF2",
  "green:100": "#DEFAE4",
  "green:200": "#BFF3CA",
  "green:300": "#8EE7A1",
  "green:400": "#63D77D",
  "green:500": "#2EB94D",
  "green:600": "#20993C",
  "green:700": "#1D7832",
  "green:800": "#1C5F2C",
  "green:900": "#194E27",
  "green:950": "#082B12",

  // Red
  "red:50": "#FEF5F2",
  "red:100": "#FFE7E1",
  "red:200": "#FFD5C9",
  "red:300": "#FEB7A3",
  "red:400": "#FB7C59",
  "red:500": "#F36740",
  "red:600": "#E14A21",
  "red:700": "#BD3C18",
  "red:800": "#9C3518",
  "red:900": "#82301A",
  "red:950": "#471608",

  // brown
  "brown:50": "#F8F6F4",

  // desert
  "desert:50": "#FAF9F7",
  "desert:100": "#EFECE5",
  "desert:950": "#2C231E",

  // White
  "white": "#FFFFFF",

  // Brand colors
  "brand:blue": "#405AE5",
  "brand:lightBlue": "#6D8AED",
  "brand:darkBlue": "#121B44",
  "brand:green": "#63D77D",
  "brand:golden": "#F5D93A",
  "brand:cyan": "#95CBF3",
  "brand:coral": "#FB7C59",
  "brand:brown": "#DBB79B",
};

// The light theme, which is the only theme for now. These
// colors are meant to be used by components via useTheme(),
// so that the theme can be changed at runtime.

// Some notes about naming conventions:
// - "xContent" is the color used over a "x" background (text, icons or outlines).
// - "xHint" is the color used to hint that "x" is interactive (generally on hover).
// - "xActive" is the color used to indicate that "x" is being interacted with (generally on press).
// - "xSurface" is the color used for the surface of "x" (generally the background).
export const lightTheme = {
  name: "light" as const,
  colors: {
    accent: "blue:500",
    accentActive: "blue:600",
    accentContent: "white",
    accentHint: "blue:400",
    background: "white",
    backgroundActive: "gray:50",
    border: "gray:200",
    borderSoft: "gray:100",
    content: "gray:950",
    contentAlt: "gray:600",
    contentAlt2: "gray:500",
    controlBorder: "gray:300",
    controlBorderStrong: "blue:950",
    controlSurface: "white",
    controlSurfaceAlt: "gray:200",
    hint: "brown:50",
    infoSurface: "desert:50",
    infoSurfaceBorder: "desert:100",
    infoSurfaceContent: "desert:950",
    dimmed: "gray:400",
    fieldBorder: "gray:100",
    fieldBorderFocused: "gray:300",
    fieldSurface: "gray:50",
    focused: "blue:500",
    focusedSurface: "blue:50",
    focusedSurfaceActive: "blue:100",
    strongSurface: "blue:950",
    strongSurfaceContent: "white",
    strongSurfaceContentAlt: "gray:500",
    strongSurfaceContentAlt2: "gray:100",
    position: "#2E2E3D",
    positionContent: "white",
    positionContentAlt: "gray:500",
    interactive: "blue:950",
    negative: "red:500",
    negativeStrong: "red:600",
    negativeActive: "red:600",
    negativeContent: "white",
    negativeHint: "red:400",
    negativeSurface: "red:50",
    negativeSurfaceBorder: "red:100",
    negativeSurfaceContent: "red:900",
    negativeSurfaceContentAlt: "red:400",
    negativeInfoSurface: "red:50",
    negativeInfoSurfaceBorder: "red:200",
    negativeInfoSurfaceContent: "red:950",
    negativeInfoSurfaceContentAlt: "gray:600",
    positive: "green:500",
    positiveAlt: "green:400",
    positiveActive: "green:600",
    positiveContent: "white",
    positiveHint: "green:400",
    secondary: "blue:50",
    secondaryActive: "blue:200",
    secondaryContent: "blue:500",
    secondaryHint: "blue:100",
    selected: "blue:500",
    separator: "gray:50",
    surface: "white",
    tableBorder: "gray:100",
    warning: "yellow:400",
    warningAlt: "yellow:300",
    warningAltContent: "blue:950",
    disabledBorder: "gray:200",
    disabledContent: "gray:500",
    disabledSurface: "gray:50",
    brandBlue: "brand:blue",
    brandBlueContent: "white",
    brandBlueContentAlt: "blue:50",
    brandDarkBlue: "brand:darkBlue",
    brandDarkBlueContent: "white",
    brandDarkBlueContentAlt: "gray:50",
    brandLightBlue: "brand:lightBlue",
    brandGolden: "brand:golden",
    brandGoldenContent: "yellow:950",
    brandGoldenContentAlt: "yellow:800",
    brandGreen: "brand:green",
    brandGreenContent: "green:950",
    brandGreenContentAlt: "green:800",

    // colors are resolved so we can animate them
    riskGradient1: "#63D77D", // green:400
    riskGradient2: "#B8E549",
    riskGradient3: "#F1C91E", // yellow:400
    riskGradient4: "#FFA12B",
    riskGradient5: "#FB7C59", // red:400

    riskGradientDimmed1: "red:100",
    riskGradientDimmed2: "yellow:100",
    riskGradientDimmed3: "green:100",

    loadingGradient1: "blue:50",
    loadingGradient2: "blue:100",
    loadingGradientContent: "blue:400",

    // not used yet
    brandCyan: "brand:cyan",
    brandCoral: "brand:coral",
    brandBrown: "brand:brown",
  } satisfies Record<string, (keyof typeof colors) | `#${string}`>,
} as const;

export type ThemeDescriptor = {
  name: "light"; // will be "light" | "dark" once dark mode is added
  colors: typeof lightTheme.colors; // lightTheme acts as a reference for types
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
  theme: lightTheme,
  setTheme: (_: ThemeDescriptor) => {},
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
  const [theme, setTheme] = useState<ThemeDescriptor>(lightTheme);
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
