module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // TypeScript's own compiler already catches unused vars/undefined
    // names correctly (with type-awareness); disable the JS versions to
    // avoid false positives on types, interfaces, and generics.
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-empty': 'off',
    'no-case-declarations': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.test.ts'],
};
