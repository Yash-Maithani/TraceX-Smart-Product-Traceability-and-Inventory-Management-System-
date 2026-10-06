import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'src/api/generated/**', 'playwright-report/**', 'test-results/**']
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-alert': 'error',
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Use Dialog or ConfirmDialog instead of window.alert.' },
        { name: 'confirm', message: 'Use ConfirmDialog instead of window.confirm.' },
        { name: 'prompt', message: 'Use a Dialog with form fields instead of window.prompt.' },
        { name: 'fetch', message: 'Call the API exclusively through src/api/client.ts.' }
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'alert', message: 'Use Dialog instead of window.alert.' },
        { object: 'window', property: 'confirm', message: 'Use ConfirmDialog instead of window.confirm.' },
        { object: 'window', property: 'prompt', message: 'Use Dialog instead of window.prompt.' },
        { object: 'window', property: 'fetch', message: 'Call fetch only inside src/api/client.ts.' },
        { object: 'globalThis', property: 'fetch', message: 'Call fetch only inside src/api/client.ts.' }
      ]
    }
  },
  {
    files: ['src/api/client.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Use Dialog or ConfirmDialog instead of window.alert.' },
        { name: 'confirm', message: 'Use ConfirmDialog instead of window.confirm.' },
        { name: 'prompt', message: 'Use a Dialog with form fields instead of window.prompt.' }
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'alert', message: 'Use Dialog instead of window.alert.' },
        { object: 'window', property: 'confirm', message: 'Use ConfirmDialog instead of window.confirm.' },
        { object: 'window', property: 'prompt', message: 'Use Dialog instead of window.prompt.' }
      ]
    }
  },
  {
    files: ['src/lib/logger.ts'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'e2e/**'],
    rules: {
      'no-console': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off'
    }
  }
);
