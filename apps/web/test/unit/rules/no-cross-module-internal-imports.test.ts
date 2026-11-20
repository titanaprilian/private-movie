import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import * as tseslint from 'typescript-eslint';
import { noCrossModuleInternalImportsRule } from '../../../eslint-rules/no-cross-module-internal-imports.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
  },
});

ruleTester.run(
  'deep-modules/no-cross-module-internal-imports',
  noCrossModuleInternalImportsRule,
  {
    valid: [
      {
        code: `import { helper } from './internal/helper';`,
        filename: '/workspace/apps/web/src/modules/videos/index.ts',
      },
      {
        code: `import { helper } from '@/modules/videos/internal/helper';`,
        filename: '/workspace/apps/web/src/modules/videos/components/Card.tsx',
      },
      {
        code: `import { helper } from '@/modules/videos/internal/helper';`,
        filename: '/workspace/apps/web/test/unit/videos/card.test.tsx',
      },
      {
        code: `import { PublicNavbar } from '@/modules/navigation';`,
        filename: '/workspace/apps/web/src/modules/videos/components/Card.tsx',
      },
      {
        code: `import { StorageView } from '@/modules/storage';`,
        filename: '/workspace/apps/web/src/routes/index.tsx',
      },
      {
        code: `import { Button } from '@/components/ui/button';`,
        filename:
          '/workspace/apps/web/src/modules/videos/internal/components/Card.tsx',
      },
    ],
    invalid: [
      {
        code: `import { api } from '@/modules/storage/internal/api';`,
        filename: '/workspace/apps/web/src/modules/videos/components/Card.tsx',
        errors: [
          {
            message:
              'Importing from the internal folder of module "storage" is not allowed from module "videos".',
          },
        ],
      },
      {
        code: `import { api } from '../storage/internal/api';`,
        filename: '/workspace/apps/web/src/modules/videos/components/Card.tsx',
        errors: [
          {
            message:
              'Importing from the internal folder of module "storage" is not allowed from module "videos".',
          },
        ],
      },
      {
        code: `import { api } from '@/modules/storage/internal/api';`,
        filename: '/workspace/apps/web/src/routes/index.tsx',
        errors: [
          {
            message:
              'Importing from the internal folder of module "storage" is not allowed from outside the module.',
          },
        ],
      },
      {
        code: `import { api } from '@/modules/storage/internal/api';`,
        filename: '/workspace/apps/web/test/unit/videos/card.test.tsx',
        errors: [
          {
            message:
              'Importing from the internal folder of module "storage" is not allowed from module "videos".',
          },
        ],
      },
      {
        code: `export { api } from '@/modules/storage/internal/api';`,
        filename: '/workspace/apps/web/src/modules/videos/components/Card.tsx',
        errors: [
          {
            message:
              'Importing from the internal folder of module "storage" is not allowed from module "videos".',
          },
        ],
      },
      {
        code: `const api = import('@/modules/storage/internal/api');`,
        filename: '/workspace/apps/web/src/modules/videos/components/Card.tsx',
        errors: [
          {
            message:
              'Importing from the internal folder of module "storage" is not allowed from module "videos".',
          },
        ],
      },
    ],
  }
);
