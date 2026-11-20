import path from 'node:path';
import process from 'node:process';

export const noCrossModuleInternalImportsRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Strictly forbid importing anything from a module's internal directory unless the importing file is located within that exact same module's directory structure.",
    },
    schema: [],
  },
  create(context) {
    function checkImport(node, importPath) {
      if (typeof importPath !== 'string') return;
      const segments = importPath.replace(/\\/g, '/').split('/');
      if (!segments.includes('internal')) {
        return;
      }

      const filename =
        context.filename ??
        (typeof context.getFilename === 'function'
          ? context.getFilename()
          : '');
      const normalizedFilename = filename.replace(/\\/g, '/');

      // Helper to get module name from path
      const getModuleName = (p) => {
        const srcMatch = p.match(/(?:^|\/)src\/modules\/([^/]+)/);
        if (srcMatch) return srcMatch[1];
        const testMatch = p.match(/(?:^|\/)test\/unit\/([^/]+)/);
        if (testMatch) return testMatch[1];
        return null;
      };

      const importerModule = getModuleName(normalizedFilename);

      // Resolve target path
      let resolvedPath = importPath;
      if (importPath.startsWith('@/')) {
        resolvedPath = importPath.replace(/^@\//, 'src/');
      } else if (importPath.startsWith('.') || path.isAbsolute(importPath)) {
        resolvedPath = path.resolve(path.dirname(filename), importPath);
      } else if (importPath.startsWith('src/')) {
        const srcIndex = normalizedFilename.indexOf('/src/');
        if (srcIndex !== -1) {
          const rootPath = filename.substring(0, srcIndex);
          resolvedPath = path.resolve(rootPath, importPath);
        } else {
          resolvedPath = path.resolve(process.cwd(), importPath);
        }
      }

      const normalizedResolvedPath = resolvedPath.replace(/\\/g, '/');
      const targetModule = getModuleName(normalizedResolvedPath);

      if (targetModule && importerModule !== targetModule) {
        context.report({
          node,
          message: `Importing from the internal folder of module "${targetModule}" is not allowed from ${importerModule ? `module "${importerModule}"` : 'outside the module'}.`,
        });
      }
    }

    return {
      ImportDeclaration(node) {
        checkImport(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          checkImport(node, node.source.value);
        }
      },
      ExportAllDeclaration(node) {
        if (node.source) {
          checkImport(node, node.source.value);
        }
      },
      ImportExpression(node) {
        if (node.source && typeof node.source.value === 'string') {
          checkImport(node, node.source.value);
        }
      },
    };
  },
};
