import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const gateSource = readFileSync(new URL('./typecheck-gate.mjs', import.meta.url), 'utf8');
const known = "src/known.ts: error TS2322: Type 'string' is not assignable to type 'number'.";
const diagnostic = "src/known.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.";

function runGate({ code, output = '', baseline = '', writeBaseline = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'typecheck-gate-test-'));
  try {
    const scriptDir = join(root, 'scripts', 'ci');
    mkdirSync(scriptDir, { recursive: true });
    writeFileSync(join(scriptDir, 'typecheck-gate.mjs'), gateSource);
    writeFileSync(join(scriptDir, 'typecheck-baseline.txt'), baseline);
    if (code !== undefined) {
      const bin = join(root, 'node_modules', '.bin');
      mkdirSync(bin, { recursive: true });
      // A finite compiler fixture, not an installed dependency. Exercise the
      // real process boundary and the maintained gate's baseline handling.
      writeFileSync(join(bin, 'tsc'),
        `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(output)});\nprocess.exit(${code});\n`,
        { mode: 0o700 });
    }
    const result = spawnSync(process.execPath,
      [join(scriptDir, 'typecheck-gate.mjs'), ...(writeBaseline ? ['--write-baseline'] : [])],
      { cwd: root, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.error, undefined);
    return { ...result, baseline: readFileSync(join(scriptDir, 'typecheck-baseline.txt'), 'utf8') };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('missing compiler cannot pass the gate', () => {
  const result = runGate();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /compiler did not complete/);
});

for (const code of [1, 2]) {
  test(`compiler failure ${code} without TypeScript diagnostics cannot pass`, () => {
    const result = runGate({ code, output: 'compiler failed to load\n' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /compiler did not complete/);
  });

  test(`normal diagnostic exit ${code} preserves the accepted baseline`, () => {
    const result = runGate({ code, output: diagnostic, baseline: known });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Typecheck gate passed/);
  });
}

test('unexpected compiler exit fails even with an accepted diagnostic', () => {
  const result = runGate({ code: 3, output: diagnostic, baseline: known });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /compiler did not complete/);
});

test('successful compilation passes and reports resolved baseline entries', () => {
  const result = runGate({ code: 0, baseline: known });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 baseline error\(s\) no longer present/);
});

test('a new TypeScript diagnostic still blocks acceptance', () => {
  const result = runGate({ code: 2, output: diagnostic });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /1 new TypeScript error\(s\)/);
});

test('generated Next diagnostics retain their existing exclusion', () => {
  const result = runGate({ code: 2, output: '.next/types/app.ts(1,1): error TS2322: generated error\n' });
  assert.equal(result.status, 0, result.stderr);
});

test('failed compiler cannot erase the baseline through write mode', () => {
  const result = runGate({ baseline: known, writeBaseline: true });
  assert.notEqual(result.status, 0);
  assert.equal(result.baseline, known);
});

test('real diagnostics can still be explicitly written as a baseline', () => {
  const result = runGate({ code: 2, output: diagnostic, writeBaseline: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.baseline, `${known}\n`);
});
