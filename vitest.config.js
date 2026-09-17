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
