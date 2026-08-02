module.exports = {
  root: true,
  extends: ["@tripplanner/eslint-config"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [".eslintrc.cjs"],
};
