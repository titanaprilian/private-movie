import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import { noCrossModuleInternalImportsRule } from './eslint-rules/no-cross-module-internal-imports.js';

const deepModulesPlugin = {
  rules: {
    'no-cross-module-internal-imports': noCrossModuleInternalImportsRule,
  },
};

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'public/**',
      'test/fixtures/complexity/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'deep-modules': deepModulesPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'deep-modules/no-cross-module-internal-imports': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'test/fixtures/complexity/**/*.{ts,tsx}'],
    rules: {
      complexity: ['error', { max: 25 }],
    },
  },
  {
    // Calibrated complexity overrides for legacy hotspot functions documented in Issue #993
    files: [
      'src/components/media/VideoPlayer.tsx',
      'src/modules/videos/internal/ingestion/bulk/hooks/useArchiveIngestSources.ts',
      'src/modules/storage/internal/components/providers/ProviderForm.tsx',
      'src/modules/videos/internal/ingestion/bulk/hooks/useBulkIngestSources.ts',
      'src/modules/videos/internal/ingestion/bulk/components/archive/ArchiveStep1.tsx',
      'src/modules/videos/internal/seasons/utils/formatEpisodeDuration.ts',
      'src/modules/watch/internal/utils/formatDuration.ts',
      'src/components/media/useVideoShortcuts.ts',
      'src/modules/videos/internal/ingestion/bulk/components/archive/ArchiveStep3.tsx',
      'src/modules/watch/internal/hooks/useSeriesWatchView.ts',
      'src/modules/storage/internal/components/dialogs/DeleteConfirmDialog.tsx',
    ],
    rules: {
      complexity: ['error', { max: 50 }],
    },
  },
  prettier
);
