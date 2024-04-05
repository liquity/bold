import { defineConfig } from "@pandacss/dev";
import { colors, theme } from "./src/theme";

const tokenColors = Object.fromEntries(
  Object.entries(colors).map(([key, value]) => [
    key,
    { value },
  ]),
);

const semanticTokenColors = Object.fromEntries(
  Object.entries(theme.colors).map(([key, value]) => [
    key,
    { value: `{colors.${value}}` },
  ]),
);

export default defineConfig({
  preflight: true, // CSS reset
  presets: ["@pandacss/preset-base"],
  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],
  theme: {
    tokens: {
      colors: tokenColors,
      fonts: {
        body: { value: "Inter, sans-serif" },
      },
    },
    semanticTokens: {
      colors: semanticTokenColors,
    },
  },
  outdir: "styled-system",
});
