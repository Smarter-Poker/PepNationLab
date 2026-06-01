#!/usr/bin/env node
/**
 * RLS policy guard.
 *
 * Offline scan over supabase/migrations/*.sql that reconstructs the final
 * RLS state and fails CI if any of the following is true:
 *
 *   1. A public table has RLS disabled and is not allowlisted as
 *      `rls_disabled_tables` (e.g. `test_realtime_dummy`).
 *
 *   2. A public table has RLS enabled but no policies. Such a table is
 *      effectively a black hole: nothing can read or write it. This is
 *      almost always a migration bug, so it fails by default.
 *
 *   3. A policy uses `USING (true)` or `WITH CHECK (true)` and is not
 *      explicitly allowlisted in `permissive_policies`. Public-read
 *      tables (e.g. shipping_rates) must be listed by name + reason,
 *      forcing every blanket read to be a conscious decision rather
 *      than a leftover.
 *
 * The scanner is purely textual — it does NOT connect to the live DB.
 * It runs on every PR (see .github/workflows/rls-guard.yml).
 *
 * Allowlist file: scripts/.rls-policy-allowlist.json
 *   {
 *     "rls_disabled_tables": [ { "table": "...", "reason": "..." } ],
 *     "permissive_policies": [ { "table": "...", "policy": "...", "reason": "..." } ]
 *   }
 *
 * Caveats:
 *   - Schema reconstruction is migration-order-sensitive; the script
 *     processes files in the same alphabetical order the Supabase CLI
 *     would apply them.
 *   - DROP POLICY IF EXISTS and CREATE POLICY are tracked. Renames via
 *     ALTER POLICY ... RENAME TO are also tracked.
 *   - ALTER TABLE ENABLE/DISABLE ROW LEVEL SECURITY is tracked.
 *   - A CREATE TABLE defaults RLS to disabled (matches Postgres).
 *   - auth.* and other non-public schemas are ignored.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const ALLOWLIST_PATH = path.join(__dirname, '.rls-policy-allowlist.json');

function readAllowlist() {
  try {
    const raw = fs.readFileSync(ALLOWLIST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const rlsDisabled = new Set();
    const permissive = new Set();
    for (const entry of parsed.rls_disabled_tables ?? []) {
      rlsDisabled.add(entry.table.toLowerCase());
    }
    for (const entry of parsed.permissive_policies ?? []) {
      permissive.add(`${entry.table}::${entry.policy}`.toLowerCase());
    }
    return { rlsDisabled, permissive };
  } catch {
    return { rlsDisabled: new Set(), permissive: new Set() };
  }
}

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

function unquoteIdent(s) {
  if (!s) return s;
  const m = s.match(/^"([^"]+)"$/);
  return m ? m[1] : s;
}

function normPolicyName(s) {
  return unquoteIdent(s.trim()).toLowerCase();
}

// Walk a paren block starting at sql[index] === '('. Returns { body, end }
// where body is the content inside the outermost parens and end is the
// index of the matching ')'.
function readParenBlock(sql, openIndex) {
  if (sql[openIndex] !== '(') return null;
  let depth = 0;
  for (let i = openIndex; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '$' && sql[i + 1] === '$') {
      const next = sql.indexOf('$$', i + 2);
      if (next === -1) return null;
      i = next + 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const closer = sql.indexOf(ch, i + 1);
      if (closer === -1) return null;
      i = closer;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return { body: sql.slice(openIndex + 1, i), end: i };
      }
    }
  }
  return null;
}

function reconstructFinalState(files) {
  const tables = new Map();

  function ensureTable(name) {
    const key = name.toLowerCase();
    if (!tables.has(key)) {
      tables.set(key, {
        original: name,
        rlsEnabled: false,
        policies: new Map(),
        seen: true,
      });
    }
    return tables.get(key);
  }

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const sql = stripComments(raw);
    const fileRel = path.relative(ROOT, file);

    // CREATE TABLE [IF NOT EXISTS] [schema.]<name>
    // Only register if schema is missing or explicitly 'public'. Skip
    // tables in 'storage', 'realtime', 'auth', etc.
    const ctRe = /create\s+table(?:\s+if\s+not\s+exists)?\s+(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*)\b/gi;
    let m;
    while ((m = ctRe.exec(sql)) !== null) {
      const schema = m[1] ? m[1].toLowerCase() : 'public';
      if (schema !== 'public') continue;
      ensureTable(unquoteIdent(m[2]));
    }

    // DROP TABLE [IF EXISTS] [schema.]<name>
    const dtRe = /drop\s+table(?:\s+if\s+exists)?\s+(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*)\b/gi;
    while ((m = dtRe.exec(sql)) !== null) {
      const schema = m[1] ? m[1].toLowerCase() : 'public';
      if (schema !== 'public') continue;
      tables.delete(unquoteIdent(m[2]).toLowerCase());
    }

    // ALTER TABLE [schema.]<name> ENABLE/DISABLE ROW LEVEL SECURITY
    const rlsRe = /alter\s+table(?:\s+if\s+exists)?\s+(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+(enable|disable)\s+row\s+level\s+security/gi;
    while ((m = rlsRe.exec(sql)) !== null) {
      const schema = m[1] ? m[1].toLowerCase() : 'public';
      if (schema !== 'public') continue;
      const t = ensureTable(unquoteIdent(m[2]));
      t.rlsEnabled = m[3].toLowerCase() === 'enable';
    }

    // DROP POLICY [IF EXISTS] "name" ON [schema.]table
    const dpRe = /drop\s+policy(?:\s+if\s+exists)?\s+("[^"]+"|[a-zA-Z_][a-zA-Z0-9_]*)\s+on\s+(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    while ((m = dpRe.exec(sql)) !== null) {
      const schema = m[2] ? m[2].toLowerCase() : 'public';
      if (schema !== 'public') continue;
      const t = ensureTable(unquoteIdent(m[3]));
      t.policies.delete(normPolicyName(m[1]));
    }

    // ALTER POLICY "old" ON [schema.]table RENAME TO "new"
    const apRenameRe = /alter\s+policy\s+("[^"]+"|[a-zA-Z_][a-zA-Z0-9_]*)\s+on\s+(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+rename\s+to\s+("[^"]+"|[a-zA-Z_][a-zA-Z0-9_]*)/gi;
    while ((m = apRenameRe.exec(sql)) !== null) {
      const schema = m[2] ? m[2].toLowerCase() : 'public';
      if (schema !== 'public') continue;
      const t = ensureTable(unquoteIdent(m[3]));
      const oldKey = normPolicyName(m[1]);
      const pol = t.policies.get(oldKey);
      if (!pol) continue;
      t.policies.delete(oldKey);
      pol.name = unquoteIdent(m[4]);
      t.policies.set(normPolicyName(m[4]), pol);
    }

    // CREATE POLICY "name" ON [schema.]table ... USING (...) WITH CHECK (...);
    const cpHead = /create\s+policy\s+("[^"]+"|[a-zA-Z_][a-zA-Z0-9_]*)\s+on\s+(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    let cm;
    while ((cm = cpHead.exec(sql)) !== null) {
      const schema = cm[2] ? cm[2].toLowerCase() : 'public';
      if (schema !== 'public') continue;
      const polName = unquoteIdent(cm[1]);
      const tableName = unquoteIdent(cm[3]);
      const bodyStart = cm.index + cm[0].length;
      const semi = sql.indexOf(';', bodyStart);
      const end = semi === -1 ? sql.length : semi;
      const body = sql.slice(bodyStart, end);

      const forMatch = body.match(/\bfor\s+(all|select|insert|update|delete)\b/i);
      const cmdName = forMatch ? forMatch[1].toUpperCase() : 'ALL';

      let usingExpr = null;
      const usingIdx = body.search(/\busing\s*\(/i);
      if (usingIdx >= 0) {
        const open = body.indexOf('(', usingIdx);
        const block = readParenBlock(body, open);
        if (block) usingExpr = block.body.trim();
      }

      let checkExpr = null;
      const checkIdx = body.search(/\bwith\s+check\s*\(/i);
      if (checkIdx >= 0) {
        const open = body.indexOf('(', checkIdx);
        const block = readParenBlock(body, open);
        if (block) checkExpr = block.body.trim();
      }

      const upto = raw.slice(0, cm.index);
      const line = upto.split('\n').length;

      const t = ensureTable(tableName);
      t.policies.set(normPolicyName(polName), {
        name: polName,
        cmd: cmdName,
        usingExpr,
        withCheckExpr: checkExpr,
        file: fileRel,
        line,
      });
    }
  }

  return tables;
}

function isTriviallyTrue(expr) {
  if (!expr) return false;
  const norm = expr.replace(/\s+/g, '').toLowerCase();
  const stripped = norm.replace(/^\((.*)\)$/, '$1');
  return norm === 'true' || stripped === 'true';
}

function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('No migrations directory at', MIGRATIONS_DIR);
    process.exit(1);
  }
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f));
  if (files.length === 0) {
    console.log('No migration files. Nothing to scan.');
    return;
  }

  const { rlsDisabled, permissive } = readAllowlist();
  const tables = reconstructFinalState(files);

  const offenders = [];

  for (const [key, t] of tables) {
    if (!t.rlsEnabled && !rlsDisabled.has(key)) {
      offenders.push({
        kind: 'rls_disabled',
        table: t.original,
        detail: 'RLS is disabled and table is not in rls_disabled_tables allowlist.',
      });
    }
    if (t.rlsEnabled && t.policies.size === 0) {
      offenders.push({
        kind: 'no_policies',
        table: t.original,
        detail: 'RLS is enabled but no CREATE POLICY survives to the final state.',
      });
    }
    for (const pol of t.policies.values()) {
      const permissiveUsing = isTriviallyTrue(pol.usingExpr);
      const permissiveCheck = isTriviallyTrue(pol.withCheckExpr);
      if (!permissiveUsing && !permissiveCheck) continue;
      const key2 = `${t.original}::${pol.name}`.toLowerCase();
      if (permissive.has(key2)) continue;
      offenders.push({
        kind: 'permissive_policy',
        table: t.original,
        policy: pol.name,
        cmd: pol.cmd,
        detail: `Policy uses ${permissiveUsing ? 'USING (true)' : ''}${permissiveUsing && permissiveCheck ? ' + ' : ''}${permissiveCheck ? 'WITH CHECK (true)' : ''} and is not allowlisted.`,
        file: pol.file,
        line: pol.line,
      });
    }
  }

  if (offenders.length === 0) {
    console.log('OK: RLS guard clean.');
    console.log(`Tables scanned: ${tables.size}  Migrations: ${files.length}`);
    let rlsOff = 0;
    let policies = 0;
    for (const t of tables.values()) {
      if (!t.rlsEnabled) rlsOff++;
      policies += t.policies.size;
    }
    console.log(`RLS-on tables: ${tables.size - rlsOff}  RLS-off (allowlisted): ${rlsOff}  Total policies: ${policies}`);
    return;
  }

  console.error('RLS guard violations:');
  console.error('');
  for (const o of offenders) {
    if (o.kind === 'rls_disabled') {
      console.error(`  [rls_disabled]   ${o.table}`);
      console.error(`     ${o.detail}`);
    } else if (o.kind === 'no_policies') {
      console.error(`  [no_policies]    ${o.table}`);
      console.error(`     ${o.detail}`);
    } else if (o.kind === 'permissive_policy') {
      console.error(`  [permissive]     ${o.table}::"${o.policy}" (${o.cmd})  ${o.file}:${o.line}`);
      console.error(`     ${o.detail}`);
    }
  }
  console.error('');
  console.error('To accept a finding, add an entry to scripts/.rls-policy-allowlist.json:');
  console.error('  rls_disabled_tables: [ { "table": "<table>", "reason": "..." } ]');
  console.error('  permissive_policies: [ { "table": "<table>", "policy": "<name>", "reason": "..." } ]');
  process.exit(1);
}

main();
