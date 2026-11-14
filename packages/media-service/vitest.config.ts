import { defineConfig, mergeConfig } from "vitest/config";
import nodeConfig from "@repo/config-vitest/vitest.node";

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
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
