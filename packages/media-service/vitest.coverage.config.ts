import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import nodeConfig from "@repo/config-vitest/vitest.node";
import { resolveTestDatabaseUrl } from "./test/utils/env";

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      fileParallelism: false,
      globalSetup: [
        path.resolve(import.meta.dirname, "./test/global-setup.ts"),
      ],
      setupFiles: [path.resolve(import.meta.dirname, "./test/setup.ts")],
      env: {
        NODE_ENV: "test",
        DATABASE_URL: resolveTestDatabaseUrl(),
      },
      coverage: {
        thresholds: {
          lines: 59,
          statements: 59,
          functions: 57,
          branches: 64,
        },
      },
    },
  }),
);
