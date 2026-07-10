/**
 * ESLint v9 flat config (015 follow-up: dropped eslint-config-next due to
 * circular-structure crash with FlatCompat + ESLint 9).
 *
 * Uses `typescript-eslint` unified package (recommended for ESLint 9):
 * - @eslint/js recommended (base JS rules)
 * - typescript-eslint recommended (TS-aware rules)
 *
 * Next.js-specific rules (react-hooks, jsx-a11y, @next/next) are NOT
 * included. The project is backend-heavy (tRPC + Drizzle); UI features
 * (008/009/010) work fine without them — TypeScript + tsx catches most
 * issues. If needed later, add `eslint-plugin-react` + `eslint-plugin-
 * react-hooks` explicitly.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const eslintConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    ignores: [
      "node_modules/",
      ".next/",
      "dist/",
      "build/",
      "coverage/",
      "src/server/db/migrations/",
      "drizzle.config.ts",
    ],
  },
);

export default eslintConfig;
