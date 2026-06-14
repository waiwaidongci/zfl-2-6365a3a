import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, 'src/lib')
    }
  },
  test: {
    include: ['src/tests/**/*.test.js'],
    globals: true,
    environment: 'node',
    setupFiles: [path.resolve(__dirname, 'src/tests/setup.js')],
    testTimeout: 15000,
    hookTimeout: 10000,
    reporters: process.env.CI
      ? ['default', 'junit']
      : ['default'],
    outputFile: process.env.CI
      ? { junit: './test-results/junit-report.xml' }
      : undefined,
    css: false,
    threads: true,
    singleThread: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.js'],
      exclude: ['**/node_modules/**']
    }
  }
});
