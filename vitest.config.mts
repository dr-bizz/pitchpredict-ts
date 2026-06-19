import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Single config for the whole repo's unit tests now that the app lives at the
// root. Resolves @pitchpredict/* via the shared tsconfig paths.
export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.base.json'] })],
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'libs/**/src/**/*.{test,spec}.{ts,tsx}',
    ],
    passWithNoTests: true,
  },
});
