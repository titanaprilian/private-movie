import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.base.ts";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      testTimeout: 20_000,
      hookTimeout: 20_000,
    },
  }),
);