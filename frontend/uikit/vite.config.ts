import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "uikit",
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
      },
    },
    emptyOutDir: false,
  },
  plugins: [
    react(),
    dts(),
  ],
});
