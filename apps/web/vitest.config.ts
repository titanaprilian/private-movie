import path from 'node:path';
import reactPreset from '@repo/config-vitest/vitest.react';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  reactPreset,
  defineConfig({
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
    test: {
      css: true,
      coverage: {
        thresholds: {
          lines: 82,
          statements: 80,
          functions: 81,
          branches: 73,
        },
      },
    },
  })
);
