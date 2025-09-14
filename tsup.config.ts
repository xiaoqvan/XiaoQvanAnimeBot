import { defineConfig } from "tsup";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

const mergedEnv: Record<string, string> = dotenv.config().parsed ?? {};

function toUnicodeEscape(str: string) {
  return str
    .split("")
    .map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
    .join("");
}

const defineEnv = Object.fromEntries(
  Object.entries(mergedEnv).map(([k, v]) => [
    `process.env.${k}`,
    JSON.stringify(toUnicodeEscape(v ?? "")),
  ])
);

async function modifyPackageJson() {
  // eslint-disable-next-line no-console
  console.log("🛠️  正在生成生产环境的 package.json...");

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

  // eslint-disable-next-line no-console
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
