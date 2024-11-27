import type { ReactNode } from "react";

import { createContext, useContext, useState } from "react";

// The Nerite base color palette, meant
// to be used by themes rather than directly.
export const colors = {
  // Blue
  "blue:50": "#f3f8ed",
  "blue:100": "#e3efd8",
  "blue:200": "#c9e1b5",
  "blue:300": "#a5cd89",
  "blue:400": "#86b764",
  "blue:500": "#679c46",
  "blue:600": "#4f7b35",
  "blue:700": "#3e5f2c",
  "blue:800": "#344d27",
  "blue:900": "#214225",
  "blue:950": "#1e3116",

  "gray:50": "#f6f6f6",
  "gray:100": "#e7e7e7",
  "gray:200": "#d1d1d1",
  "gray:300": "#b0b0b0",
  "gray:400": "#888888",
  "gray:500": "#6d6d6d",
  "gray:600": "#5d5d5d",
  "gray:700": "#4f4f4f",
  "gray:800": "#454545",
  "gray:900": "#3d3d3d",
  "gray:950": "#070707",

  "yellow:50": "#faf8f2",
  "yellow:100": "#f3eee2",
  "yellow:200": "#e5dcc3",
  "yellow:300": "#d4c49d",
  "yellow:400": "#c2a775",
  "yellow:500": "#b5915a",
  "yellow:600": "#a87f4e",
  "yellow:700": "#8c6742",
  "yellow:800": "#72533a",
  "yellow:900": "#5c4432",
  "yellow:950": "#312319",

  "green:50": "#f3f8f8",
  "green:100": "#e1ebec",
  "green:200": "#c5d9dc",
  "green:300": "#8bb2b7",
  "green:400": "#6e9ba2",
  "green:500": "#537f87",
  "green:600": "#476a73",
  "green:700": "#3f585f",
  "green:800": "#394b51",
  "green:900": "#334146",
  "green:950": "#1e292e",

  "red:50": "#fdf5ef",
  "red:100": "#fae7da",
  "red:200": "#f3c2a5",
  "red:300": "#eea883",
  "red:400": "#e67c51",
  "red:500": "#e05a2f",
  "red:600": "#d24324",
  "red:700": "#ae3220",
  "red:800": "#8b2a21",
  "red:900": "#70261e",
  "red:950": "#3c100e",

  "brown:50": "#faf8f2",

  "desert:50": "#FAF9F7",
  "desert:100": "#EFECE5",
  "desert:950": "#2C231E",

  white: "#FFFFFF",

  "brand:blue": "#476a73",
  "brand:green": "#679c46",
  "brand:darkBlue": "#070707",
  "brand:golden": "#c2a775",
  "brand:cyan": "#8bb2b7",
  "brand:coral": "#e67c51",
  "brand:brown": "#8c6742",
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
    disabledBorder: "gray:200",
    disabledContent: "gray:500",
    disabledSurface: "gray:50",
    brandBlue: "brand:blue",
    brandBlueContent: "white",
    brandBlueContentAlt: "blue:50",
    brandDarkBlue: "brand:darkBlue",
    brandDarkBlueContent: "white",
    brandDarkBlueContentAlt: "gray:50",
    brandGolden: "brand:golden",
    brandGoldenContent: "yellow:950",
    brandGoldenContentAlt: "yellow:800",
    brandGreen: "brand:green",
    brandGreenContent: "green:950",
    brandGreenContentAlt: "green:800",

    riskGradient1: "green:400",
    riskGradient2: "#B8E549",
    riskGradient3: "yellow:400",
    riskGradient4: "#FFA12B",
    riskGradient5: "red:500",

    loadingGradient1: "blue:50",
    loadingGradient2: "blue:100",
    loadingGradientContent: "blue:400",

    // not used yet
    brandCyan: "brand:cyan",
    brandCoral: "brand:coral",
    brandBrown: "brand:brown",
  } satisfies Record<string, keyof typeof colors | `#${string}`>,
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

export function Theme({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeDescriptor>(lightTheme);
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
