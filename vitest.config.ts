import { defineConfig } from 'vitest/config';

// Single entry point for the whole repo's unit tests. Each project keeps its
// own vitest.config.mts (root, includes, environment); this just runs them all
// under one `vitest run`.
export default defineConfig({
  test: {
    projects: [
      'apps/web/vitest.config.mts',
      'libs/contracts/vitest.config.mts',
      'libs/db/vitest.config.mts',
    ],
  },
});
