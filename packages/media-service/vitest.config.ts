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
          lines: 48,
          statements: 48,
          functions: 53,
          branches: 66,
        },
      },
    },
  }),
);
