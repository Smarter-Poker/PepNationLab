import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.env.RETIREMENT_SOURCE_ROOT || process.cwd());
const forbidden = /@sentry\/|(?:https?:\/\/)?[^\s"']*sentry\.io|\bSENTRY_[A-Z_]+|\bNEXT_PUBLIC_SENTRY_[A-Z_]+|sentry\.\w+\.config|withSentryConfig|(?:lib\/sentry|messenger\/sentryCall)/i;
function files(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : /\.(?:[cm]?[jt]sx?|json)$/.test(path) ? [path] : [];
  });
}
test('active application source, CSP and lock graph cannot restore retired telemetry', () => {
  const paths = ['app', 'components', 'lib', 'public'].flatMap(files);
  assert.ok(paths.length > 100, 'Expected real application source');
  paths.push(...readdirSync(root).filter(p => /^(?:.*config\.[cm]?[jt]s|instrumentation.*|proxy\.ts|package(?:-lock)?\.json)$/.test(p)));
  const found = paths.filter(path => forbidden.test(readFileSync(join(root, path), 'utf8')));
  assert.deepEqual(found, []);
});
