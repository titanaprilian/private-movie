import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import nodeConfig from "@repo/config-vitest/vitest.node";

export default mergeConfig(
  nodeConfig,
  defineConfig({
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    test: {
      dir: "./test/unit",
      passWithNoTests: true,
      fileParallelism: false,
      env: {
        NODE_ENV: "test",
        DATABASE_URL: "postgres://postgres:root_password@localhost:5432/private_movie_test",
        JWT_SECRET: "test-only-secret-do-not-use-in-production",
      },
      setupFiles: ["./test/setup.ts"],
    },
  }),
);