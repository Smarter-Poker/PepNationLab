/**
 * Test stub for the `server-only` package.
 *
 * `server-only` is a Next.js build-time guard: importing it in a module that
 * ends up in a client bundle is a hard build error. It has no meaningful runtime
 * implementation outside a React Server Component graph -- the published package
 * only exposes an empty module under the `react-server` export condition and
 * intentionally throws otherwise. It is also not a declared dependency here;
 * Next.js aliases it internally during the build.
 *
 * Vitest resolves through the default `node` condition, so every module guarded
 * with `import 'server-only'` (lib/supabase/server.ts, lib/compounds-server.ts)
 * failed to resolve and took its whole test suite down with it. Aliasing
 * `server-only` to this empty module in vitest.config.ts keeps the production
 * guard intact while making those modules importable under test.
 */
export {};
