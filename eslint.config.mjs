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
      'apps/web/public/sw.js',
      'apps/web/public/sw.js.map',
      'apps/web/public/workbox-*.js',
      'apps/web/public/workbox-*.js.map',
      'apps/web/public/fallback-*.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Next.js + React rules, scoped to the web app.
  ...fixupConfigRules(compat.extends('next', 'next/core-web-vitals')).map(
    (config) => ({
      ...config,
      files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
      settings: { ...config.settings, next: { rootDir: 'apps/web' } },
    }),
  ),
  // Playwright rules, scoped to the e2e suite.
  {
    ...playwright.configs['flat/recommended'],
    files: ['apps/web-e2e/**/*.{ts,js}'],
  },
  // CommonJS config files (e.g. next.config.js) legitimately use require().
  {
    files: ['**/*.cjs', '**/next.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // Disable formatting rules that conflict with Prettier.
  eslintConfigPrettier,
);
