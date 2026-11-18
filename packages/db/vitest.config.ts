import { defineConfig, mergeConfig } from "vitest/config";
import nodeConfig from "@repo/config-vitest/vitest.node";

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      coverage: {
        thresholds: {
          lines: 95,
          statements: 95,
          functions: 95,
          branches: 90,
        },
      },
    },
  }),
);
