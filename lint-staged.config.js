import path from "node:path";

/**
 * ESLint configs are per-app flat configs (tsconfigRootDir = the app dir) and the linter
 * binary is installed per workspace, so ESLint must run with the app as cwd.
 * lint-staged appends staged file paths to the command (absolute paths), so rewrite them
 * relative to the app directory. `bunx --cwd` changes directory without a shell, which
 * lint-staged 17 requires since it spawns commands without one.
 */
const eslintIn = (cwd) => (files) => {
  const relative = files.map((file) => path.relative(cwd, file));
  return `bunx --cwd ${JSON.stringify(cwd)} eslint --fix ${relative
    .map((file) => JSON.stringify(file))
    .join(" ")}`;
};

export default {
  // Deep Modules boundary rules are enforced only for these two apps today.
  "apps/backend/**/*.{ts,tsx}": eslintIn("apps/backend"),
  "apps/web/**/*.{ts,tsx}": eslintIn("apps/web"),
  // Everything Prettier understands; .prettierignore already excludes apps/android-tv,
  // dist, node_modules, *.gen.ts and fixtures. Runs last so final formatting wins.
  "*": "prettier --ignore-unknown --write",
};
