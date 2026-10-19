import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


export default tseslint.config([
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions:
    {
      parser: tseslint.parser,
      globals: {
        RCAdapter: 'readonly',
        exports: 'readonly',
        chrome: true,
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-case-declarations': 'off',
      'no-param-reassign': ["error", { "props": true }]
    }
  }
]);
