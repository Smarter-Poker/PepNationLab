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
      // `server-only` is a Next.js build-time guard with no runtime implementation
      // outside a React Server Component graph, and it is not a declared dependency
      // (Next aliases it internally during the build). Vitest resolves through the
      // default `node` condition, so any module guarded with `import 'server-only'`
      // -- lib/supabase/server.ts, lib/compounds-server.ts -- failed to resolve and
      // took its entire test suite down with it. Alias it to an empty stub so those
      // modules are importable under test while the production guard stays intact.
      'server-only': path.resolve(__dirname, '__tests__/stubs/server-only.ts'),
    },
  },
});
