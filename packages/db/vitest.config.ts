import { defineConfig, mergeConfig } from "vitest/config";
import nodeConfig from "@repo/config-vitest/vitest.node";

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      coverage: {
        thresholds: {
          lines: 72,
          statements: 72,
          functions: 14,
          branches: 60,
        },
      },
    },
  }),
);
