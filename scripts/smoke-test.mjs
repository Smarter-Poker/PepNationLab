#!/usr/bin/env node
/**
 * Production smoke test - a standalone health check for the key public routes.
 *
 * Zero application risk: this is a throwaway script that only makes GET
 * requests and checks HTTP status codes. It does NOT import or touch app code.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                       # checks https://pepnationlab.com
 *   node scripts/smoke-test.mjs https://staging.url   # checks a custom base
 *   BASE_URL=https://... node scripts/smoke-test.mjs
 *
 * Exits non-zero if any check fails, so it can gate a deploy or run on a
 * schedule. Catches regressions like a broken city page, storefront, or
 * research route before users (or Google) do.
 */

const BASE = (process.argv[2] || process.env.BASE_URL || 'https://pepnationlab.com').replace(/\/$/, '');

// path -> expected status(es). Guest agent storefronts 302 -> /researchstore
// then 200, so following redirects yields 200. Intentional 404s are asserted too.
const CHECKS = [
  { path: '/', expect: [200] },
  { path: '/researchstore', expect: [200] },
  { path: '/research', expect: [200] },
  { path: '/research/compare', expect: [200] },
  { path: '/research/compare/bpc-157-vs-tb-500', expect: [200] },
  { path: '/research/bpc-157', expect: [200] },
  { path: '/peptides', expect: [200] },
  { path: '/peptides/illinois/oak-lawn', expect: [200] },
  { path: '/find-a-peptide', expect: [200] },
  { path: '/peptide-101', expect: [200] },
  { path: '/login', expect: [200] },
  { path: '/signup', expect: [200] },
  { path: '/sitemap.xml', expect: [200] },
  { path: '/robots.txt', expect: [200] },
  { path: '/api/health', expect: [200] },
  // A URL that must NOT resolve (nonexistent slug) - guards against a broken
  // catch-all that would 200 or 500 instead of a clean 404.
  { path: '/this-slug-should-not-exist-xyz', expect: [404] },
];

async function check({ path, expect }) {
  const url = `${BASE}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'PNL-SmokeTest/1.0' } });
    const ms = Date.now() - started;
    const ok = expect.includes(res.status);
    return { path, url, status: res.status, ok, ms, expect };
  } catch (err) {
    return { path, url, status: 'ERR', ok: false, ms: Date.now() - started, expect, error: String(err?.message || err) };
  }
}

const results = await Promise.all(CHECKS.map(check));

let failed = 0;
for (const r of results) {
  const tag = r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) failed++;
  const detail = r.ok ? `${r.status} (${r.ms}ms)` : `${r.status} expected ${r.expect.join('/')}${r.error ? ' - ' + r.error : ''}`;
  console.log(`${tag}  ${r.path.padEnd(42)} ${detail}`);
}

console.log(`\n${results.length - failed}/${results.length} checks passed against ${BASE}`);
if (failed > 0) {
  console.error(`SMOKE TEST FAILED: ${failed} route(s) unhealthy.`);
  process.exit(1);
}
console.log('All key routes healthy.');
