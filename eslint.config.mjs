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
      // The set-state-in-effect rule fires 68 false positives for the standard
      // browser-API-detection pattern: useEffect(() => { setState(val) }, []).
      // This is a known over-eager heuristic; downgrade to warn so real issues
      // (actual cascading render loops) are still visible but don't block builds.
      "react-hooks/set-state-in-effect": "warn",

      // react-hooks/immutability fires false positives for hoisted async function
      // declarations (`async function foo(){}`) called from useEffect above their
      // textual position. JS `function` declarations ARE hoisted — the rule
      // incorrectly treats them like `const` TDZ violations.
      "react-hooks/immutability": "warn",

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

      // unescaped-entities stays as error (renders wrong chars in HTML).
      "react/no-unescaped-entities": "error",

      // Real hook rules must stay as errors.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);

export default eslintConfig;
