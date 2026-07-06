import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignore custom scripts/scratch
    "scratch/**",
    "scripts/**",
    "*.js",
    "*.mjs",
    ".venv/**",
    "venv/**",
    "pepnationrx/**",
  ]),
  // Project-level rule overrides.
  {
    rules: {


      // any types are being phased out incrementally — warn not error.
      "@typescript-eslint/no-explicit-any": "warn",

      // Unused vars are warnings; unused imports degrade bundle but don't crash.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],

      // prefer-const is a style issue, not a correctness issue.
      "prefer-const": "warn",

      // no-require-imports stays as error (real correctness issue in ESM).
      "@typescript-eslint/no-require-imports": "error",

    },
  },
]);

export default eslintConfig;
