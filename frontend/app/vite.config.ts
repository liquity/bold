import type { ViteUserConfig } from "vitest/config";

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),
  ] as NonNullable<ViteUserConfig["plugins"]>,
  test: {
    coverage: {
      include: [
        "src/formatting.ts",
        "src/liquity-math.ts",
      ],
    },
    server: {
      deps: {
        inline: [
          "@floating-ui/react-dom",
          "@floating-ui/dom",
          "@floating-ui/core",
          "@floating-ui/utils",
          "focus-trap-react",
          "prop-types",
          "react-is",
          "object-assign",
          "focus-trap",
          "tabbable",
          "blo",
        ],
      },
    },
  },
  resolve: {
    alias: {
      "@/": __dirname,
    },
  },
});
