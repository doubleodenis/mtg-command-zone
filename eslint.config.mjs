import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // Allow underscore prefix for unused vars
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow any when truly needed (consider keeping as warn)
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow @ts-ignore with description
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description" },
      ],
      // Console warnings (catch in CI, allow in dev)
      //   "no-console": ["warn", { allow: ["warn", "error"] }],
      // Apostrophes and quotes in JSX text are fine
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default eslintConfig;
