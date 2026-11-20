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
    ignores: ['dist', 'node_modules', 'public/**'],
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
  prettier
);
