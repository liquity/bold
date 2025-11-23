"use client";

import type { ReactNode } from "react";

import { createContext, useContext, useState } from "react";

// Base color palette, adapted to match your design system
export const colors = {
  // Blue (keeping existing as accent colors)
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

  // Gray - Updated to match "Ancestral Snowberry" palette
  "gray:50": "#FAFAFA",
  "gray:100": "#F5F5F5",
  "gray:200": "#EEEEEE",
  "gray:300": "#E0E0E0",
  "gray:400": "#BDBDBD",
  "gray:500": "#9E9E9E",
  "gray:600": "#757575",
  "gray:700": "#616161",
  "gray:800": "#424242",
  "gray:900": "#212121",
  "gray:950": "#121212",

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
  "green:50": "#F1FAF1",
  "green:100": "#E8F5E8",
  "green:200": "#D4EAD4",
  "green:300": "#B8DBB8",
  "green:400": "#9DCC9D",
  "green:500": "#81C784",
  "green:600": "#66BB6A",
  "green:700": "#4CAF50",
  "green:800": "#43A047",
  "green:900": "#388E3C",
  "green:950": "#2E7D32",

  // Red
  "red:50": "#FFEBEE",
  "red:100": "#FFCDD2",
  "red:200": "#EF9A9A",
  "red:300": "#E57373",
  "red:400": "#EF5350",
  "red:500": "#F44336",
  "red:600": "#E53935",
  "red:700": "#D32F2F",
  "red:800": "#C62828",
  "red:900": "#B71C1C",
  "red:950": "#8B0000",

  // Black - Updated to match "Optophobia Black" and "Eerie Rider"
  "black:50": "#2A2A2A",
  "black:100": "#1F1F1F",
  "black:200": "#1A1A1A",
  "black:300": "#141414",
  "black:400": "#0F0F0F",
  "black:500": "#0A0A0A",
  "black:600": "#050505",
  "black:700": "#000000",

  // Hydargyrum (Mercury/Silver)
  "silver:100": "#B8B8B8",
  "silver:200": "#A0A0A0",
  "silver:300": "#888888",

  // brown
  "brown:50": "#F8F6F4",

  // desert
  "desert:50": "#FAF9F7",
  "desert:100": "#EFECE5",
  "desert:950": "#2C231E",

  // White
  "white": "#FFFFFF",

  // Brand colors
  "brand:blue": "#1A1A1A",
  "brand:lightBlue": "#6D8AED",
  "brand:darkBlue": "#0A0A0A",
  "brand:green": "#81C784",
  "brand:golden": "#F5D93A",
  "brand:cyan": "#95CBF3",
  "brand:coral": "#FB7C59",
  "brand:brown": "#DBB79B",
};

// The light theme with updated colors
export const lightTheme = {
  name: "light" as const,
  colors: {
    accent: "gray:700",
    accentActive: "gray:600",
    accentContent: "white",
    accentHint: "gray:500",
    background: "black:700",
    backgroundActive: "gray:50",
    border: "gray:600",
    borderSoft: "gray:100",
    content: "white",
    contentAlt: "gray:600",
    contentAlt2: "gray:500",
    controlBorder: "gray:300",
    controlBorderStrong: "black:600",
    controlSurface: "gray:900",
    controlSurfaceAlt: "gray:800",
    hint: "brown:50",
    infoSurface: "desert:50",
    infoSurfaceBorder: "desert:100",
    infoSurfaceContent: "black:600",
    dimmed: "gray:400",
    fieldBorder: "gray:600",
    fieldBorderFocused: "gray:500",
    fieldSurface: "gray:900",
    focused: "blue:500",
    focusedSurface: "gray:800",
    focusedSurfaceActive: "gray:700",
    strongSurface: "black:600",
    strongSurfaceContent: "white",
    strongSurfaceContentAlt: "gray:500",
    strongSurfaceContentAlt2: "gray:100",
    position: "black:700",
    positionContent: "white",
    positionContentAlt: "gray:500",
    interactive: "gray:400",
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
    negativeInfoSurfaceContent: "black:700",
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
    surface: "black:700",
    tableBorder: "gray:100",
    warning: "yellow:400",
    warningAlt: "yellow:300",
    warningAltContent: "black:700",
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

    riskGradient1: "#81C784", // green:500
    riskGradient2: "#B8E549",
    riskGradient3: "#F1C91E", // yellow:400
    riskGradient4: "#FF7043",
    riskGradient5: "#E57373", // red:300

    riskGradientDimmed1: "red:100",
    riskGradientDimmed2: "yellow:100",
    riskGradientDimmed3: "green:100",

    loadingGradient1: "black:400",
    loadingGradient2: "black:300",
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