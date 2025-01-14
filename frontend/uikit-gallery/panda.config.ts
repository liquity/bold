import type { Preset } from "@pandacss/dev";

import { liquityUiKitPreset } from "@liquity2/uikit/panda.config";
import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true, // CSS reset
  presets: [
    liquityUiKitPreset as Preset, // `as Preset` prevents a type error: "Expression produces a union type that is too complex to represent."
  ],
  exclude: [],
  outdir: "styled-system",
  include: [
    "../uikit/src/**/*.tsx",
    "./src/**/*.{ts,tsx}",
  ],
});
