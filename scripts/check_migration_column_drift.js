#!/usr/bin/env node
/**
 * Migration column drift guard.
 *
 * Scans every .sql under supabase/migrations/ for NEW.<col>/OLD.<col>
 * references inside trigger functions, identifies the target table from
 * the CREATE TRIGGER ... ON <table> EXECUTE FUNCTION <fn>() pairing, and
 * verifies the column exists in the union of CREATE TABLE and
 * ALTER TABLE ... ADD COLUMN statements across all migrations.
 *
 * The check is offline — no DB connection required — so it runs on every
 * PR before the migration is applied. Exits non-zero if it finds any
 * reference to a column that no migration introduces.
 *
 * False positives can be silenced by listing the column in
 * scripts/.column-drift-allowlist.json, formatted as:
 *   { "allowed": [ { "table": "<table>", "column": "<col>", "reason": "..." } ] }
 *
 * Caveats:
 * - Only checks `public.` schema; auth.* and other schemas are skipped.
 * - Schema is reconstructed from migrations on disk. If a column was added
 *   by a collapsed migration or by direct DB edit, allowlist it.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const ALLOWLIST_PATH = path.join(__dirname, '.column-drift-allowlist.json');

function readAllowlist() {
  try {
    const raw = fs.readFileSync(ALLOWLIST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const set = new Set();
    for (const entry of parsed.allowed ?? []) {
      set.add(`${entry.table}.${entry.column}`.toLowerCase());
    }
    return set;
  } catch {
    return new Set();
  }
}

// Strip /* ... */ and -- to end-of-line comments
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

function parseCreateTableColumns(body) {
  // Body is between the outermost ( ... ) of CREATE TABLE.
  // Split by top-level commas (depth=0), then take the first identifier
  // of each segment if the segment doesn't start with a constraint keyword.
  const cols = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) cols.push(current);

  const result = [];
  const KEYWORDS = /^(constraint|primary|foreign|unique|check|like|exclude)\b/i;
  for (const seg of cols) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    if (KEYWORDS.test(trimmed)) continue;
    const m = trimmed.match(/^"?([a-zA-Z_][a-zA-Z0-9_]*)"?\b/);
    if (m) result.push(m[1].toLowerCase());
  }
  return result;
}

function buildSchemaFromMigrations(files) {
  // table -> Set(columns)
  const schema = new Map();
  const addCol = (table, col) => {
    const t = table.toLowerCase();
    const c = col.toLowerCase();
    if (!schema.has(t)) schema.set(t, new Set());
    schema.get(t).add(c);
  };

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const sql = stripComments(raw);

    // CREATE TABLE [IF NOT EXISTS] [public.]<name> ( ... );
    // Iterate manually to handle nested parens correctly.
    const tableRe = /create\s+table(?:\s+if\s+not\s+exists)?\s+(?:(?:public|auth)\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
    let m;
    while ((m = tableRe.exec(sql)) !== null) {
      const table = m[1];
      // Walk from m.index forward to find the matching closing paren
      let i = m.index + m[0].length - 1; // position of '('
      let depth = 0;
      let start = i + 1;
      for (; i < sql.length; i++) {
        const ch = sql[i];
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth === 0 && i < sql.length) {
        const body = sql.slice(start, i);
        for (const c of parseCreateTableColumns(body)) {
          addCol(table, c);
        }
      }
    }

    // ALTER TABLE [IF EXISTS] [public.]<name> ADD COLUMN [IF NOT EXISTS] <col>
    const alterRe = /alter\s+table(?:\s+if\s+exists)?\s+(?:(?:public|auth)\.)?([a-z_][a-z0-9_]*)\s+add\s+column(?:\s+if\s+not\s+exists)?\s+"?([a-z_][a-z0-9_]*)"?/gi;
    let am;
    while ((am = alterRe.exec(sql)) !== null) {
      addCol(am[1], am[2]);
    }
  }
  return schema;
}

function findTriggerColumnRefs(rawSql) {
  // Returns Array<{ table, col, kind: 'NEW'|'OLD', line }>
  const refs = [];
  const sql = stripComments(rawSql);

  // Map function name -> table from CREATE TRIGGER ... ON [public.]<table> ... EXECUTE FUNCTION [public.]<fn>()
  const fnToTable = new Map();
  const trigRe = /create\s+(?:or\s+replace\s+)?trigger\s+[a-z0-9_]+[\s\S]*?on\s+(?:(public|auth)\.)?([a-z_][a-z0-9_]*)[\s\S]*?execute\s+function\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;
  let tm;
  while ((tm = trigRe.exec(sql)) !== null) {
    const schema = (tm[1] || 'public').toLowerCase();
    if (schema !== 'public') continue; // skip auth.* and other non-public triggers
    const table = tm[2].toLowerCase();
    const fn = tm[3].toLowerCase();
    fnToTable.set(fn, table);
  }

  // For each CREATE [OR REPLACE] FUNCTION <fn>, find NEW./OLD. references inside the body.
  // We find function blocks by locating "create [or replace] function ... as $$ ... $$" or "... begin ... end;".
  const fnHeadRe = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\([\s\S]*?\)[\s\S]*?(?:as\s+\$\$|begin)/gi;
  let fh;
  while ((fh = fnHeadRe.exec(sql)) !== null) {
    const fn = fh[1].toLowerCase();
    const table = fnToTable.get(fn);
    if (!table) continue;
    // Body extends until matching closing $$ or end of file
    const bodyStart = fh.index + fh[0].length;
    // Try $$ first
    const dollarEnd = sql.indexOf('$$', bodyStart);
    const body = dollarEnd > 0 ? sql.slice(bodyStart, dollarEnd) : sql.slice(bodyStart, bodyStart + 4000);

    const colRe = /\b(NEW|OLD)\.([a-z_][a-z0-9_]*)/g;
    let cm;
    while ((cm = colRe.exec(body)) !== null) {
      const absoluteIndex = bodyStart + cm.index;
      const upto = rawSql.slice(0, absoluteIndex);
      const line = upto.split('\n').length;
      refs.push({ table, col: cm[2].toLowerCase(), kind: cm[1], line });
    }
  }
  return refs;
}

function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('No migrations directory found at', MIGRATIONS_DIR);
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

  const schema = buildSchemaFromMigrations(files);
  const allowlist = readAllowlist();

  const offenders = [];
  const seen = new Set();
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    const refs = findTriggerColumnRefs(sql);
    for (const r of refs) {
      const key = `${r.table}.${r.col}`.toLowerCase();
      if (allowlist.has(key)) continue;
      const cols = schema.get(r.table);
      if (!cols || !cols.has(r.col)) {
        // dedupe per (file, table, col, kind)
        const dedupeKey = `${file}::${r.kind}.${r.table}.${r.col}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        offenders.push({
          file: path.relative(ROOT, file),
          line: r.line,
          kind: r.kind,
          table: r.table,
          column: r.col,
        });
      }
    }
  }

  if (offenders.length === 0) {
    console.log('OK: no trigger NEW./OLD. column refs reference unknown columns.');
    console.log(`Tables scanned: ${schema.size}  Migrations: ${files.length}`);
    return;
  }

  console.error('Migration column drift detected. These triggers reference columns');
  console.error('that no CREATE TABLE / ALTER TABLE ADD COLUMN in supabase/migrations/');
  console.error('introduces on the target public-schema table:');
  console.error('');
  for (const o of offenders) {
    console.error(`  ${o.file}: ${o.kind}.${o.column}  (table ${o.table})`);
  }
  console.error('');
  console.error('If the column genuinely exists (e.g. added by a collapsed migration),');
  console.error('add an allowlist entry to scripts/.column-drift-allowlist.json:');
  console.error('  { "allowed": [ { "table": "<table>", "column": "<col>", "reason": "..." } ] }');
  process.exit(1);
}

main();
