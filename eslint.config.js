import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist/', 'dist-firefox/', 'node_modules/', 'coverage/', 'fixtures/', '.context/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, chrome: 'readonly' },
    },
    rules: {
      // Logging is the primary failure-reporting channel for this extension.
      'no-console': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['*.config.ts', '*.config.js', 'manifest.config.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
)
