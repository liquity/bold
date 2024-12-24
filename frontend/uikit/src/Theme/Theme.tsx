import type { ReactNode } from "react";

import { createContext, useContext, useState } from "react";

// The Liquity V2 base color palette, meant
// to be used by themes rather than directly.
export const colors = {
  // Gray
  "gray:50": "#F5F6F8",
  "gray:100": "#E6E9EB",
  "gray:200": "#CDD3D7",
  "gray:300": "#B4BEC3",
  "gray:400": "#9BA8AF",
  "gray:500": "#82929B",
  "gray:600": "#697C87",
  "gray:700": "#506673",
  "gray:800": "#37515F",
  "gray:900": "#1E3B4B",
  "gray:1000": "#052537",

  // Green
  "green:100": "#D5FCE6",
  "green:200": "#ADF9D4",
  "green:300": "#81EEC4",
  "green:400": "#5EDEB8",
  "green:500": "#2FC8AA",
  "green:600": "#22AC9E",
  "green:700": "#17908F",
  "green:800": "#0E6B74",
  "green:900": "#095060",
  "green:1000": "#073A45",

  // Yellow
  "yellow:100": "#FFF9DA",
  "yellow:200": "#FFF2B6",
  "yellow:300": "#FFE992",
  "yellow:400": "#FFE077",
  "yellow:500": "#FFD24A",
  "yellow:600": "#DBAD36",
  "yellow:700": "#B78B25",
  "yellow:800": "#936B17",
  "yellow:900": "#7A540E",
  "yellow:1000": "#5C3C10",

  // Red
  "red:100": "#FDDADA",
  "red:200": "#FCB5BB",
  "red:300": "#F68FA1",
  "red:400": "#EC7094",
  "red:500": "#E14480",
  "red:600": "#C13176",
  "red:700": "#A2226C",
  "red:800": "#82155F",
  "red:900": "#6C0D57",
  "red:1000": "#5F0B4D",

  // brown
  "brown:50": "#F8F6F4",

  // desert
  "desert:50": "#FAF9F7",
  "desert:100": "#EFECE5",
  "desert:950": "#2C231E",

  // White
  white: "#FFFFFF",

  // Brand colors
  "brand:darkBlue": "#051937",
  "brand:waterB": "#00C9B7",
  "brand:grassG": "#A8EB12",
  "brand:golden": "#f5d93a",
  "brand:coralP": "#fb7c59",

  //
  "text:black": "#3f3f3f",
  "text:grey": "#87A2A4",
  "bg:black": "#052537",
  "bg:grey20": "#F2F8F8",

  // TODO: Remove
  error: "#ff0000",
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
    accent: "green:500",
    accentActive: "green:600",
    accentContent: "white",
    accentHint: "green:400",
    background: "white",
    backgroundActive: "gray:50",
    border: "gray:200",
    borderSoft: "gray:100",
    content: "text:black",
    contentAlt: "text:grey",
    contentAlt2: "gray:500",
    controlBorder: "#1C1D4F",
    controlSurface: "white",
    controlSurfaceAlt: "gray:200",
    hint: "brown:50",
    infoSurface: "desert:50",
    infoSurfaceBorder: "desert:100",
    infoSurfaceContent: "desert:950",
    dimmed: "gray:400",
    fieldBorder: "gray:100",
    fieldBorderFocused: "gray:300",
    fieldSurface: "bg:grey20",
    focused: "green:500",
    focusedSurface: "gray:50",
    focusedSurfaceActive: "green:100",
    // strongSurface: "green:950",
    strongSurface: "error",
    strongSurfaceContent: "white",
    strongSurfaceContentAlt: "gray:500",
    strongSurfaceContentAlt2: "gray:100",
    position: "#2E2E3D",
    positionContent: "white",
    positionContentAlt: "gray:500",
    interactive: "text:black",
    negative: "red:500",
    negativeStrong: "red:600",
    negativeActive: "red:600",
    negativeContent: "white",
    negativeHint: "red:400",
    negativeSurface: "red:100",
    negativeSurfaceBorder: "red:100",
    negativeSurfaceContent: "red:900",
    negativeSurfaceContentAlt: "red:400",
    // negativeInfoSurface: "red:50",
    negativeInfoSurface: "error",
    negativeInfoSurfaceBorder: "red:200",
    // negativeInfoSurfaceContent: "red:950",
    negativeInfoSurfaceContent: "error",
    negativeInfoSurfaceContentAlt: "gray:600",
    positive: "green:500",
    positiveAlt: "green:400",
    positiveActive: "green:600",
    positiveContent: "white",
    positiveHint: "green:400",
    secondary: "#E7F6F6",
    secondaryActive: "green:200",
    secondaryContent: "green:500",
    secondaryHint: "green:100",
    selected: "green:500",
    separator: "gray:50",
    surface: "bg:grey20",
    tableBorder: "gray:100",
    warning: "yellow:400",
    warningAlt: "yellow:300",
    disabledBorder: "#DDE8E6",
    disabledContent: "text:grey",
    disabledSurface: "#F4F8F8",
    // brandgreen: "brand:blue",
    brandgreen: "error",
    brandBlueContent: "white",
    // brandBlueContentAlt: "green:50",
    brandBlueContentAlt: "error",
    brandDarkgreen: "brand:darkBlue",
    brandDarkBlueContent: "white",
    brandDarkBlueContentAlt: "gray:50",
    // brandLightgreen: "brand:lightBlue",
    brandLightgreen: "error",
    brandGolden: "brand:golden",
    // brandGoldenContent: "yellow:950",
    brandGoldenContent: "error",
    brandGoldenContentAlt: "yellow:800",
    // brandGreen: "brand:green",
    brandGreen: "error",
    // brandGreenContent: "green:950",
    brandGreenContent: "error",
    brandGreenContentAlt: "green:800",

    riskGradient1: "green:400",
    riskGradient2: "#B8E549",
    riskGradient3: "yellow:400",
    riskGradient4: "#FFA12B",
    riskGradient5: "red:500",

    loadingGradient1: "green:100",
    loadingGradient2: "green:200",
    loadingGradientContent: "green:400",

    // not used yet
    // brandCyan: "brand:cyan",
    brandCyan: "error",
    // brandCoral: "brand:coral",
    brandCoral: "error",
    // brandBrown: "brand:brown",
    brandBrown: "error",
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
