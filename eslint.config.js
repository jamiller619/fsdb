import typescriptParser from '@typescript-eslint/parser';

export default [
  {
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        tsconfigRootDir: '.',
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
  }
];
