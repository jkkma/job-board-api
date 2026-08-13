import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'prisma/migrations/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Async route handlers that forget `await` are the most common source of
      // silently-swallowed errors in an Express app.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Bans stray `console.log` debugging while leaving genuine diagnostics alone.
      'no-console': ['error', { allow: ['error', 'warn'] }],
      eqeqeq: ['error', 'smart'],
    },
  },

  {
    // Config files aren't part of the TypeScript program, so the type-aware
    // rules have nothing to work with.
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    // Boot-time failures and the seed script have no logger to fall back on.
    files: ['src/server.ts', 'src/config/env.ts', 'prisma/seed.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    // supertest types `res.body` as `any`, so asserting on a response payload
    // trips every unsafe-* rule. Relaxing them here keeps the signal in src/.
    files: ['tests/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  }
);
