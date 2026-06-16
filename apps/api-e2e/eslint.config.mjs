import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // The e2e harness boots the API in-process for supertest, so it legitimately
    // imports the `api` app module by path. e2e suites are not part of the app's
    // dependency graph, so the module-boundary constraint does not apply here.
    files: ['src/support/**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
];
