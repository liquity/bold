import { liquityUiKitPreset } from "@liquity2/uikit/panda.config";
import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

export default defineConfig({
  preflight: true, // CSS reset
  presets: [liquityUiKitPreset],
  exclude: [],
  outdir: "styled-system",
  include: [
    "../uikit/src/**/*.tsx",
    "./src/**/*.{ts,tsx}",
  ],
  globalCss: defineGlobalStyles({
    "html, body": {
      color: "content",
      fontWeight: "500",
      lineHeight: "1.5",
      fontSize: 16,
    },
  }),
});
