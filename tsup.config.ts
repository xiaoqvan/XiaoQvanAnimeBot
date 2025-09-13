import { defineConfig } from "tsup";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

const mergedEnv: Record<string, string> = dotenv.config().parsed ?? {};

const defineEnv = Object.fromEntries(
  Object.entries(mergedEnv).map(([k, v]) => [
    `process.env.${k}`,
    JSON.stringify(v ?? ""),
  ])
);

async function modifyPackageJson() {
  const filePath = path.resolve("package.json");
  const newFilePath = path.resolve("dist/package.json");

  // 读取原始 package.json
  const raw = await fs.readFile(filePath, "utf-8");
  const pkg = JSON.parse(raw);

  // 覆盖 scripts
  pkg.scripts = {
    start: "node --enable-source-maps index.js",
    debug: "node --enable-source-maps index.js --debug",
    pm2: "pm2 start index.js --name \"xiaoqvan-anime-bot\" --node-args='--enable-source-maps'",
  };

  // 删除 devDependencies
  delete pkg.devDependencies;

  // 写入新的 package.json
  await fs.writeFile(newFilePath, JSON.stringify(pkg, null, 2), "utf-8");

  console.log(`✅ 已生成 ${newFilePath}`);
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: false,
  minify: true,
  define: {
    ...defineEnv,
  },
  onSuccess: async () => {
    modifyPackageJson();
  },
});
