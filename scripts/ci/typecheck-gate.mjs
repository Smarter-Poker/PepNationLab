#!/usr/bin/env node
/**
 * Typecheck gate: fails CI only when NEW TypeScript errors are introduced.
 *
 * Why this exists: next.config.ts sets typescript.ignoreBuildErrors = true, so
 * type errors do NOT fail `next build`. Real runtime crashes have shipped to
 * production as a result (e.g. an admin route calling gate.user.id when the
 * guard returns { userId }, and an undefined getIcon() crashing a modal). This
 * gate runs the full `tsc --noEmit` and compares the result against a committed
 * baseline of known-accepted errors. Any error NOT in the baseline fails the
 * job; the pre-existing baseline errors do not block. Generated .next/ output
 * is ignored (it only exists after a build).
 *
 * Update the baseline (only to REMOVE fixed errors, never to silence new ones):
 *   node scripts/ci/typecheck-gate.mjs --write-baseline
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, 'typecheck-baseline.txt');

function collectErrorSignatures() {
  let out = '';
  try {
    out = execSync('node_modules/.bin/tsc --noEmit -p tsconfig.json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    // tsc exits non-zero whenever errors exist; that is expected here. Use the
    // captured stdout/stderr rather than treating the exit code as a failure.
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  const seen = new Set();
  for (const raw of out.split('\n')) {
    if (!raw.includes('error TS')) continue;
    const line = raw.trim();
    // Skip generated Next.js type output - absent until `next build` runs.
    if (/^\.next[\\/]/.test(line)) continue;
    // Normalize away the (line,col) so unrelated edits do not churn signatures.
    seen.add(line.replace(/\(\d+,\d+\)/, ''));
  }
  return [...seen].sort();
}

const current = collectErrorSignatures();

if (process.argv.includes('--write-baseline')) {
  writeFileSync(baselinePath, current.length ? current.join('\n') + '\n' : '');
  console.log(`Wrote ${current.length} baseline signature(s) to ${baselinePath}`);
  process.exit(0);
}

const baseline = existsSync(baselinePath)
  ? new Set(readFileSync(baselinePath, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean))
  : new Set();

const introduced = current.filter((sig) => !baseline.has(sig));
const fixed = [...baseline].filter((sig) => !current.includes(sig));

if (fixed.length) {
  console.log(`Note: ${fixed.length} baseline error(s) no longer present. Consider shrinking the baseline with --write-baseline:`);
  for (const s of fixed) console.log(`  - ${s}`);
  console.log('');
}

if (introduced.length) {
  console.error(`Typecheck gate FAILED: ${introduced.length} new TypeScript error(s) introduced:\n`);
  for (const s of introduced) console.error(`  ${s}`);
  console.error('\nFix these, or (only if genuinely intentional) update the baseline:\n  node scripts/ci/typecheck-gate.mjs --write-baseline');
  process.exit(1);
}

console.log(`Typecheck gate passed: no new TypeScript errors (baseline accepts ${baseline.size}).`);
process.exit(0);
