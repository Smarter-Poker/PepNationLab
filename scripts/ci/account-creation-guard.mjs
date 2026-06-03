#!/usr/bin/env node
/**
 * Account-creation route guard.
 *
 * Hardening for a regression class we've already hit twice: routes that
 * call `auth.admin.createUser()` MUST use `createAdminClient()` (raw
 * @supabase/supabase-js with the service_role key) for the subsequent
 * profile write. The @supabase/ssr-based `createServiceClient()` can
 * silently fall back to the caller's authenticated JWT and fail to
 * bypass RLS, 500ing the entire account-creation flow.
 *
 * This script:
 *   1. Walks every .ts file under app/api/
 *   2. Flags files that contain `auth.admin.createUser`
 *   3. Asserts every flagged file ALSO imports `createAdminClient`
 *   4. Exits non-zero if any file fails the check
 *
 * Run it in CI before deploy. Catches the regression before it ships.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd(), 'app/api');
const verbose = process.argv.includes('--list');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (s.isFile() && p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);

const violations = [];
const scanned = [];

for (const f of files) {
  const src = readFileSync(f, 'utf8');

  // Heuristic: this is an account-creation route iff it calls auth.admin.createUser
  // (i.e. spawns a new auth user that needs a profile row).
  if (!/auth\.admin\.createUser\s*\(/.test(src)) continue;

  scanned.push(f);

  // Must import createAdminClient. The route may also import createClient
  // for the caller's session — that's fine. The forbidden combination is
  // "auth.admin.createUser is called AND createAdminClient is NOT imported".
  const importsAdmin = /import\s+\{[^}]*\bcreateAdminClient\b[^}]*\}\s+from\s+['"]@\/lib\/supabase\/server['"]/.test(src);

  if (!importsAdmin) {
    violations.push({
      file: f,
      issue: 'auth.admin.createUser is called but createAdminClient is not imported from @/lib/supabase/server',
    });
  }

  // Secondary check: every profile write in an account-creation route should go
  // through the admin client. If `createServiceClient` is used in a route that
  // ALSO calls auth.admin.createUser, flag it — that's the historical broken
  // pattern. (Existing routes import createServiceClient for read-only access
  // sometimes; we only error on the write paths.)
  const usesServiceClient = /\bcreateServiceClient\s*\(/.test(src);
  const writesProfile = /\.from\(\s*['"]profiles['"]\s*\)[\s\S]*?\.(upsert|insert|update)\s*\(/.test(src);
  if (usesServiceClient && writesProfile && importsAdmin) {
    // Soft-warn — both clients present, profile write may flow through either.
    violations.push({
      file: f,
      issue:
        'route calls auth.admin.createUser AND uses createServiceClient AND writes to profiles. ' +
        'Verify the profile write specifically uses createAdminClient (NOT createServiceClient).',
    });
  }
}

if (verbose) {
  console.log('\nAccount-creation routes scanned:');
  for (const f of scanned) console.log('  ' + f.replace(process.cwd() + '/', ''));
  console.log('');
}

if (violations.length > 0) {
  console.error('\n[account-creation-guard] FAIL — ' + violations.length + ' violation(s):\n');
  for (const v of violations) {
    console.error('  ' + v.file.replace(process.cwd() + '/', ''));
    console.error('    ' + v.issue);
    console.error('');
  }
  console.error(
    'Fix: replace createServiceClient with createAdminClient (from @/lib/supabase/server) for the\n' +
    'profile write half of every route that calls auth.admin.createUser. createAdminClient uses raw\n' +
    '@supabase/supabase-js + service_role key — the only client that reliably bypasses RLS in this codebase.'
  );
  process.exit(1);
}

console.log(
  '[account-creation-guard] OK — ' +
  scanned.length +
  ' route' +
  (scanned.length === 1 ? '' : 's') +
  ' scanned, no violations.'
);
process.exit(0);
