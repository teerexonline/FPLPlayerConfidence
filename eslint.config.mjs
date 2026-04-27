import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // TypeScript strict-type-checked rules applied to TS/TSX source files
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce logger over raw console
      'no-console': 'error',

      // Ban `any` — use `unknown` + narrowing
      '@typescript-eslint/no-explicit-any': 'error',

      // Ban non-null assertions
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Ban unsafe type assertions — Zod-validated output and unknown-narrowing are the only exceptions
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],

      // Exhaustive switches on discriminated unions
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // Typed results preferred over throwing
      '@typescript-eslint/only-throw-error': 'error',

      // No floating promises
      '@typescript-eslint/no-floating-promises': 'error',

      // No unnecessary type parameters
      '@typescript-eslint/no-unnecessary-type-parameters': 'error',

      // Allow _-prefixed parameters that are intentionally unused (stubs, callbacks)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // The logger module is the one permitted place to call console.* directly.
  // All other source code must use the Logger interface from src/lib/logger/.
  // Tests in this directory use vi.spyOn(console, ...) which also references console.
  {
    files: ['src/lib/logger/**'],
    rules: { 'no-console': 'off' },
  },

  // Scripts are developer tools, not production source — allow console.* and other relaxations.
  {
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },

  // Disable rules that conflict with Prettier (must be last)
  prettierConfig,

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
    // scripts/** is intentionally NOT ignored here — it is linted with relaxed rules
    // via the { files: ['scripts/**'] } override above. Ignoring it globally would
    // make that override dead code and silently allow any rule violation in scripts.
  ]),
]);

export default eslintConfig;
