const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['**/*.js', 'node_modules/**'],
  },
  ...tseslint.configs.recommended
);
