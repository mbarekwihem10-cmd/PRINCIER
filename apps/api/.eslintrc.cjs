module.exports = {
  root: true,
  extends: ["@tripplanner/eslint-config/nestjs"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [".eslintrc.cjs"],
};
