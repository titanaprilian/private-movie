import { defineConfig, mergeConfig } from "vitest/config";
import nodeConfig from "@repo/config-vitest/vitest.node";

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      coverage: {
        thresholds: {
          lines: 96,
          statements: 96,
          functions: 31,
          branches: 99,
        },
      },
    },
  }),
);
