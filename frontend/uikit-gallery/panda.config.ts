import { liquityUiKitPreset } from "@liquity2/uikit/panda.config";
import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true, // CSS reset
  presets: [liquityUiKitPreset],
  exclude: [],
  outdir: "styled-system",
  include: [
    "../uikit/src/**/*.tsx",
    "./src/**/*.{ts,tsx}",
  ],
});
