import type { Preset } from "@pandacss/dev";

import { liquityUiKitPreset } from "@liquity2/uikit/panda.config";
import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

export default defineConfig({
  preflight: true, // CSS reset
  presets: [liquityUiKitPreset as Preset], // prevents a type error: "Expression produces a union type that is too complex to represent."
  exclude: [],
  outdir: "styled-system",
  include: [
    "../uikit/src/**/*.tsx",
    "./src/**/*.{ts,tsx}",
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
