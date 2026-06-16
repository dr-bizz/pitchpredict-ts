export default {
  displayName: 'api-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // These flows boot Nest + hit Postgres; give them headroom.
  testTimeout: 60_000,
  // Run serially: the suite mutates shared rows (predictions/results).
  maxWorkers: 1,
  coverageDirectory: '../../coverage/apps/api-e2e',
};
