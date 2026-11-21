import { defineConfig, mergeConfig } from "vitest/config";
import nodeConfig from "@repo/config-vitest/vitest.node";

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      dir: "./test/unit",
      passWithNoTests: true,
      coverage: {
        thresholds: {
          lines: 51,
          statements: 51,
          functions: 56,
          branches: 67,
        },
      },
    },
  }),
);
