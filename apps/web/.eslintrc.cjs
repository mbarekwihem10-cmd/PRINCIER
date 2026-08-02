module.exports = {
  root: true,
  extends: ["@tripplanner/eslint-config/nextjs"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [".eslintrc.cjs", "next.config.ts", ".next", "next-env.d.ts"],
};
