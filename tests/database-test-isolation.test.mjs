import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDatabaseTestTarget } from '../scripts/ci/check-db-test-target.mjs';
const isolated = 'abcdefghijklmnopqrst';
test('database fixture target refuses production and missing isolation evidence', () => {
  for (const ref of ['ydsaqnnuwyvtyxgvrnys', 'kuklfnapbkmacvwxktbh', 'cupnhfdwveouenutnveg'])
    assert.throws(() => validateDatabaseTestTarget(`https://${ref}.supabase.co`, ref), /Production/);
  assert.throws(() => validateDatabaseTestTarget('', ''), /explicitly configured/);
});
test('database fixture URL must exactly match its isolated project', () => {
  assert.equal(validateDatabaseTestTarget(`https://${isolated}.supabase.co`, isolated), true);
  for (const url of [`http://${isolated}.supabase.co`, `https://${isolated}.supabase.co.evil.test`, `https://other.supabase.co`, `https://user:password@${isolated}.supabase.co`])
    assert.throws(() => validateDatabaseTestTarget(url, isolated), /must match/);
});
test('CI checks isolation before running any fixture and never rewinds installed history', () => {
  const db = readFileSync(new URL('../.github/workflows/tests-db.yml', import.meta.url), 'utf8');
  assert.ok(db.indexOf('node scripts/ci/check-db-test-target.mjs') < db.indexOf('run: npm run test:db'));
  assert.match(db, /SUPABASE_TEST_PROJECT_REF/);
  const migration = readFileSync(new URL('../.github/workflows/deploy-migrations.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(migration, /migration repair|db push|SUPABASE_DB_PASSWORD|SUPABASE_ACCESS_TOKEN/);
  assert.match(migration, /test-browser-structural-privileges/);
});
