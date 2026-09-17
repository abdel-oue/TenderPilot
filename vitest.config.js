import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'api',
          root: './apps/api',
          include: ['tests/**/*.test.js'],
          environment: 'node',
          // lib/env.js parses process.env at import time, so the fake env has to
          // be in place before the first import, not inside a beforeAll.
          setupFiles: ['./tests/setup.js'],
        },
      },
      {
        test: {
          name: 'web',
          root: './apps/web',
          include: ['tests/**/*.test.ts'],
          exclude: ['e2e/**'],
          environment: 'node',
        },
      },
    ],
  },
});
