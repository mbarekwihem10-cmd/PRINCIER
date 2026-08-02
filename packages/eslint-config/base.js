/**
 * Configuration ESLint de base — TripPlanner.
 * Applique les standards définis dans le Handbook d'ingénierie, section 2.
 * Toute dérogation locale doit être justifiée par un commentaire.
 */
module.exports = {
  root: false,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
    tsconfigRootDir: process.cwd(),
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "eslint-config-prettier",
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Handbook 2.5 : aucun `any` non justifié
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": [
      "warn",
      { allowExpressions: true },
    ],
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    // Handbook 2.6 : pas de console.log en dehors du dev
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "import/order": [
      "warn",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
        ],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
    "import/no-cycle": "error",
  },
  ignorePatterns: [
    "dist",
    "build",
    ".next",
    ".expo",
    "node_modules",
    "*.config.js",
  ],
};
