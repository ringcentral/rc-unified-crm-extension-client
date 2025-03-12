import globals from "globals";
import pluginJs from "@eslint/js";


/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions:
    {
      globals: {
        RCAdapter: 'readonly',
        exports: 'readonly',
        chrome: true,
        ...globals.browser
      }
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      'no-unused-vars': 'off',
      'no-case-declarations': 'off',
      'no-param-reassign': ["error", { "props": true }]
    }
  }
];