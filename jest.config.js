module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testMatch: ['**/__tests__/**/*.test.js'],
  // Sets required secrets/env for every test file BEFORE modules load
  setupFiles: ['<rootDir>/src/__tests__/jest.setup.js'],
};