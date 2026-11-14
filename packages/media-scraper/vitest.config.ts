import { defineConfig, mergeConfig } from "vitest/config";
import nodeConfig from "@repo/config-vitest/vitest.node";

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      coverage: {
        thresholds: {
          lines: 89,
          statements: 89,
          functions: 96,
          branches: 74,
        },
      },
    },
  }),
);
