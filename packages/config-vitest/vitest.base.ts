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
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reportOnFailure: true,
      reporter: ["text-summary", "lcov", "html", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/.turbo/**",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/test/**",
        "**/migrations/**",
        "**/drizzle/**",
        "**/*.gen.ts",
        "**/src/index.ts", // barrels + server entry (apps/backend), pure re-exports elsewhere
        "**/src/client.ts", // side-effectful DB / HTTP client bootstrap
        "**/src/main.tsx", // web bootstrap
      ],
    },
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
