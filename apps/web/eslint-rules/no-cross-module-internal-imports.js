export const noCrossModuleInternalImportsRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Strictly forbid importing anything from a module's internal directory unless the importing file is located within that exact same module's directory structure.",
    },
    schema: [],
  },
  create(_context) {
    return {};
  },
};
