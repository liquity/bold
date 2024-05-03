import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "icons/index": resolve(__dirname, "src/icons/index.ts"),
      },
      formats: ["es"],
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        "@pandacss/dev",
        "@react-spring/web",
        "react",
        "react-dom",
        "react/jsx-runtime",
        "ts-pattern",
      ],
      output: {
        banner: () => "'use client';",
        preserveModules: true,
        dir: "dist",
      },
    },
    emptyOutDir: false,
  },
  plugins: [
    react(),
    dts(),
  ],
});
