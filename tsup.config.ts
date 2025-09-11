import { defineConfig } from "tsup";
import dotenv from "dotenv";

const mergedEnv: Record<string, string> = dotenv.config().parsed ?? {};

const defineEnv = Object.fromEntries(
  Object.entries(mergedEnv).map(([k, v]) => [
    `process.env.${k}`,
    JSON.stringify(v ?? ""),
  ])
);

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  minify: false,
  define: {
    ...defineEnv,
  },
});
