import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { FlatCompat } from '@eslint/eslintrc';
import { fixupConfigRules } from '@eslint/compat';
import playwright from 'eslint-plugin-playwright';
import eslintConfigPrettier from 'eslint-config-prettier';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default tseslint.config(
  {
    ignores: [
      '**/dist',
      '**/.next',
      '**/out-tsc',
      '**/coverage',
      '**/node_modules',
      '**/*.timestamp*',
      // next-pwa generated service worker artifacts (generated, not source).
      'public/sw.js',
      'public/sw.js.map',
      'public/workbox-*.js',
      'public/workbox-*.js.map',
      'public/fallback-*.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Next.js + React rules, scoped to the web app sources.
  ...fixupConfigRules(compat.extends('next', 'next/core-web-vitals')).map(
    (config) => ({
      ...config,
      files: ['app/**/*.{ts,tsx,js,jsx}', 'src/**/*.{ts,tsx,js,jsx}', 'middleware.ts'],
      settings: { ...config.settings, next: { rootDir: '.' } },
    }),
  ),
  // Playwright rules, scoped to the e2e suite.
  {
    ...playwright.configs['flat/recommended'],
    files: ['e2e/**/*.{ts,js}'],
  },
  // CommonJS config files (e.g. next.config.js) legitimately use require() and
  // Node globals (require/module/process/__dirname).
  {
    files: ['**/*.cjs', '**/next.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // Disable formatting rules that conflict with Prettier.
  eslintConfigPrettier,
);
