import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "es2019",
  external: [
    // list peer dependencies here if any, e.g. "react", "react-dom"
  ]
});
