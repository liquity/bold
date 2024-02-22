import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true, // CSS reset
  presets: ["@pandacss/preset-base"],
  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],
  theme: {
    extend: {},
  },
  outdir: "styled-system",
});
