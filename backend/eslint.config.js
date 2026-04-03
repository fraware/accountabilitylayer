const eslint = require('@eslint/js');
const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  eslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'bench/**', 'scripts/**', 'coverage/**'],
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'commonjs',
      },
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
