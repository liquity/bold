import type { Preset } from "@pandacss/dev";

import { liquityUiKitPreset } from "@liquity2/uikit/panda.config";
import { defineConfig, defineGlobalStyles, definePreset } from "@pandacss/dev";

export default defineConfig({
  preflight: true, // CSS reset
  jsxFramework: "react", // needed for panda to extract props named `css`
  presets: [
    liquityUiKitPreset as Preset, // `as Preset` prevents a type error: "Expression produces a union type that is too complex to represent."
    definePreset({
      name: "liquity-app",
      theme: {
        extend: {
          breakpoints: {
            small: "400px",
            medium: "800px",
            large: "1140px",
          },
        },
      },
    }),
  ],
  exclude: [],
  outdir: "styled-system",
  include: [
    "../uikit/src/**/*.tsx",
    "./src/**/*.{ts,tsx}",
    "./*.tsx",
  ],
  globalCss: defineGlobalStyles({
    "html, body": {
      lineHeight: 1.5,
      fontSize: 16,
      fontWeight: 500,
      color: "content",
      background: "background",
    },
  }),
});
