import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/db',
  plugins: [tsconfigPaths({ projects: ['../../tsconfig.base.json'] })],
  test: {
    name: 'db',
    watch: false,
    globals: true,
    // The db lib ships schema/client/seed only; its behavior is exercised by the
    // api and contracts test suites. No unit specs live here, so don't fail.
    passWithNoTests: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/db',
      provider: 'v8' as const,
    },
  },
}));
