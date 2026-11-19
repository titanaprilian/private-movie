import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import nodeConfig from "@repo/config-vitest/vitest.node";

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
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ??
          process.env.DATABASE_URL ??
          "postgres://postgres:root_password@localhost:5432/private_movie_test",
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
