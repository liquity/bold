import type { ReactNode } from "react";

import { createContext, useContext, useState } from "react";

// The Liquity V2 base color palette, meant
// to be used by themes rather than directly.
export const colors = {
  "darkPurple:10": "#F5F3F8",
  "darkPurple:20": "#D9D7DD",
  "darkPurple:30": "#BDBBC3",
  "darkPurple:40": "#A19FA8",
  "darkPurple:50": "#86838D",
  "darkPurple:60": "#6A6672",
  "darkPurple:70": "#4E4A58",
  "darkPurple:80": "#322E3D",
  "darkPurple:90": "#191426",
  "darkPurple:100": "#181325",
  "darkPurple:110": "#171323",
  "darkPurple:120": "#161222",

  "grayPurple:10": "#F3F3F3",
  "grayPurple:20": "#D5D4D9",
  "grayPurple:30": "#B8B5C0",
  "grayPurple:40": "#9A96A6",
  "grayPurple:50": "#7C778C",
  "grayPurple:60": "#6D6881",
  "grayPurple:70": "#5E5976",
  "grayPurple:80": "#4F4A6B",
  "grayPurple:90": "#413A61",
  "grayPurple:100": "#322B56",
  "grayPurple:110": "#231C4B",
  "grayPurple:120": "#140D40",

  "purple:10": "#F6F4FC",
  "purple:20": "#ECE9F4",
  "purple:30": "#D5D2E5",
  "purple:40": "#BEBAD5",
  "purple:50": "#A7A3C6",
  "purple:60": "#908CB7",
  "purple:70": "#7A75A8",
  "purple:80": "#635D98",
  "purple:90": "#4C4689",
  "purple:100": "#352F7A",
  "purple:110": "#1E176A",
  "purple:120": "#07005B",

  "lightPurple:10" : "#FAF1FF",
  "lightPurple:20" : "#DFC5FF",
  "lightPurple:30" : "#C49AFF",
  "lightPurple:40" : "#A86EFF",
  "lightPurple:50" : "#8D42FF",
  "lightPurple:60" : "#7B39E8",
  "lightPurple:70" : "#692FD0",
  "lightPurple:80" : "#635D98",
  "lightPurple:90" : "#5726B9;",
  "lightPurple:100" : "#34138A;",
  "lightPurple:110" : "#220972;",
  "lightPurple:120" : "#461CA1;",

  // Orange
  "orange:10": "#FFF2DC",
  "orange:20": "#FED2A8",
  "orange:30": "#FDB174",
  "orange:40": "#FC9140",
  "orange:50": "#E38038",
  "orange:60": "#C96F30",
  "orange:70": "#B05E28",
  "orange:80": "#974D20",
  "orange:90": "#7D3B18",
  "orange:100": "#642A10",
  "orange:110": "#4A1908",
  "orange:120": "#310800",

  // Yellow
  "yellow:10": "#FFF790",
  "yellow:20": "#FFEB68",
  "yellow:30": "#FFDF40",
  "yellow:40": "#E7C839",
  "yellow:50": "#CFB232",
  "yellow:60": "#B69B2B",
  "yellow:70": "#9E8524",
  "yellow:80": "#866E1C",
  "yellow:90": "#6E5815",
  "yellow:100": "#3D2B07",
  "yellow:110": "#251400",
  "yellow:120": "#55410E",

  // Blue
  "blue:10": "#E8F6FF",
  "blue:20": "#94E8FF",
  "blue:30": "#3FD9FF",
  "blue:40": "#38C4E5",
  "blue:50": "#31AFCB",
  "blue:60": "#2A99B2",
  "blue:70": "#238498",
  "blue:80": "#1C6F7E",
  "blue:90": "#155A64",
  "blue:100": "#0E444B",
  "blue:110": "#072F31",
  "blue:120": "#001A17",
  
  // Gray
  "gray:10": "#F4F4F4",
  "gray:20": "#D1D1D3",
  "gray:30": "#AFADB2",
  "gray:40": "#8C8A92",
  "gray:50": "#6A6671",
  "gray:60": "#474350",
  "gray:70": "#3F3B49",
  "gray:80": "#373342",
  "gray:90": "#2F2A3B",
  "gray:100": "#272234",
  "gray:110": "#1F1A2D",
  "gray:120": "#171226",

  // brown
  "brown:50": "#F8F6F4",

  // desert
  "desert:50": "#FAF9F7",
  "desert:100": "#EFECE5",
  "desert:950": "#2C231E",

  // White
  "white": "#FFFFFF",

  "transparent": "#00000000",

  // Brand colors
  "brand:darkPurple": "#392F5A",
  "brand:orange": "#FF7004",
  "brand:yellow": "#FFB404",
  "brand:green": "#9DD9D2",

  //
  "text:black": "#171226",
  "main:main": "#FC9140",

  // Blue
  // "blue:50": "#F0F3FE",
  // "blue:100": "#DEE4FB",
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
  // "gray:50": "#F5F6F8",
  // "gray:100": "#EDEFF2",
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
  // "yellow:50": "#FDFBE9",
  // "yellow:100": "#FCF8C5",
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
  // "green:50": "#F1FCF2",
  // "green:100": "#DEFAE4",
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
  // "brown:50": "#F8F6F4",

  // desert
  // "desert:50": "#FAF9F7",
  // "desert:100": "#EFECE5",
  // "desert:950": "#2C231E",

  // White
  // "white": "#FFFFFF",

  // Brand colors
  "brand:blue": "#405AE5",
  "brand:lightBlue": "#6D8AED",
  "brand:darkBlue": "#121B44",
  // "brand:green": "#63D77D",
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
    accent: "main:main",
    accentActive: "blue:600",
    accentContent: "white",
    accentHint: "blue:400",
    background: "#221C34",
    backgroundActive: "gray:50",
    border: "grayPurple:60",
    borderSoft: "gray:100",
    content: "white",
    contentAlt: "darkPurple:20",
    contentAlt2: "gray:500",
    controlBorder: "gray:300",
    controlBorderStrong: "blue:950",
    controlSurface: "purple:80",
    controlSurfaceAlt: "gray:200",
    hint: "brown:50",
    infoSurface: "desert:50",
    infoSurfaceBorder: "desert:100",
    infoSurfaceContent: "desert:950",
    dimmed: "gray:400",
    fieldBorder: "gray:100",
    fieldBorderFocused: "gray:300",
    fieldSurface: "grayPurple:100",
    focused: "blue:500",
    focusedSurface: "purple:70",
    focusedSurfaceActive: "blue:100",
    strongSurface: "blue:950",
    strongSurfaceContent: "white",
    strongSurfaceContentAlt: "gray:500",
    strongSurfaceContentAlt2: "gray:100",
    position: "purple:90",
    positionContent: "white",
    positionContentAlt: "gray:500",
    interactive: "white",
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
    positive: "main:main",
    positiveAlt: "main:main",
    positiveActive: "main:main",
    positiveContent: "white",
    positiveHint: "main:main",
    secondary: "#FC914033",
    secondaryActive: "blue:200",
    secondaryContent: "blue:500",
    secondaryHint: "blue:100",
    selected: "main:main",
    separator: "gray:50",
    surface: "#322A4B",
    tableBorder: "gray:100",
    warning: "yellow:400",
    warningAlt: "yellow:300",
    disabledBorder: "transparent",
    disabledContent: "purple:20",
    disabledSurface: "purple:70",
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

    riskGradient1: "green:400",
    riskGradient2: "#B8E549",
    riskGradient3: "yellow:400",
    riskGradient4: "#FFA12B",
    riskGradient5: "red:500",

    loadingGradient1: "purple:60",
    loadingGradient2: "purple:80",
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



