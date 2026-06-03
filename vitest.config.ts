import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: [
      '__tests__/**/*.test.ts',
      '__tests__/**/*.test.tsx',
      '**/__tests__/**/*.test.ts',
      '**/__tests__/**/*.test.tsx',
    ],
    exclude: ['__tests__/e2e/**', 'node_modules/**', '.next/**'],
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
