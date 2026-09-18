import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    silent: true,
    setupFiles: [path.resolve(import.meta.dirname, "./setup.ts")],
    onConsoleLog(log) {
      if (log.includes("was not wrapped in act")) return false;
      if (log.includes("Not implemented: Window")) return false;
      if (log.includes("Not implemented: navigation")) return false;
      if (log.includes("Failed to resolve mirror")) return false;
      if (log.includes("No iframe found in mirror response")) return false;
      if (log.includes("db connection failed")) return false;
    },
  },
});