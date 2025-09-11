import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  // 忽略 dist 目录
  {
    ignores: ["dist/**", "node_modules/**"],
  },

  // JavaScript 基础规则
  js.configs.recommended,

  // TypeScript 文件规则
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      // 使用 @typescript-eslint 实现，关闭基础规则
      "no-unused-vars": "off",
      eqeqeq: "error",
      // TypeScript 自身会做未定义检查，避免 ESLint no-undef 误报
      "no-undef": "off",
    },
  },
];
