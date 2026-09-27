// Guard: the third-party error tracker was retired on 2026-09-27 (account
// closed). This test fails if any dependency, import, config file, env var or
// CSP allowance for it comes back. The provider name is assembled at runtime
// so this file does not match its own search.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const provider = ['sen', 'try'].join('');
const sdk = new RegExp(`@${provider}/`, 'i');
const anyUse = new RegExp(`@${provider}/|${provider}\\.io|${provider}_(dsn|org|project|auth_token)|with${provider}config`, 'i');

function walk(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '.next' ? [] : walk(rel);
    return /\.(?:[cm]?[jt]sx?)$/.test(e.name) ? [rel] : [];
  });
}

describe('retired error tracker', () => {
  it('is not declared in package.json or the lockfile', () => {
    for (const file of ['package.json', 'package-lock.json']) {
      expect(sdk.test(fs.readFileSync(path.join(root, file), 'utf8')), file).toBe(false);
    }
  });

  it('has no config or instrumentation files', () => {
    for (const file of [
      `${provider}.client.config.ts`,
      `${provider}.server.config.ts`,
      `${provider}.edge.config.ts`,
      `lib/${provider}.ts`,
    ]) {
      expect(fs.existsSync(path.join(root, file)), file).toBe(false);
    }
  });

  it('is not imported, configured or allowed by CSP anywhere in app source', () => {
    const files = [
      ...['app', 'components', 'lib', 'hooks', 'stores', 'types', 'scripts'].flatMap(walk),
      ...['next.config.ts', 'proxy.ts', 'instrumentation.ts', 'instrumentation-client.ts', 'vercel.json'].filter((f) =>
        fs.existsSync(path.join(root, f)),
      ),
    ];
    const offenders = files.filter((f) => anyUse.test(fs.readFileSync(path.join(root, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
