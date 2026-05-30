/**
 * Messenger Sanitization Regression Test (Phase 15)
 *
 * Run with the Node 20+ built-in test runner:
 *
 *   node --test --import tsx/esm __tests__/messenger-sanitize.test.ts
 *
 * Or, if `tsx` is not installed, transpile the sanitize module on the fly
 * via a tiny loader. The cleanest invocation for CI today is:
 *
 *   npx tsx --test __tests__/messenger-sanitize.test.ts
 *
 * Goal: regression-guard `sanitizeMessageText` so future edits can't quietly
 * weaken the dangerous-scheme filter that protects rendered message bodies
 * against `javascript:` / `data:` / `vbscript:` / `file:` injection.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeMessageText } from '../lib/messenger/sanitize';

test('javascript: scheme is rejected', () => {
  assert.equal(sanitizeMessageText('javascript:alert(1)'), null);
  assert.equal(sanitizeMessageText('Click here: javascript:alert(1)'), null);
  assert.equal(sanitizeMessageText('JavaScript:doEvil()'), null);
});

test('data: scheme is rejected', () => {
  assert.equal(sanitizeMessageText('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeMessageText('Look at this data:image/png;base64,xxx'), null);
});

test('vbscript: scheme is rejected', () => {
  assert.equal(sanitizeMessageText('vbscript:msgbox("xss")'), null);
  assert.equal(sanitizeMessageText('VBScript:Evil()'), null);
});

test('file: scheme is rejected', () => {
  assert.equal(sanitizeMessageText('file:///etc/passwd'), null);
  assert.equal(sanitizeMessageText('FILE://server/share'), null);
});

test('plain http(s) URLs are preserved', () => {
  assert.equal(sanitizeMessageText('http://example.com'), 'http://example.com');
  assert.equal(sanitizeMessageText('https://pepnationlab.com/path'), 'https://pepnationlab.com/path');
});

test('plain text is preserved verbatim (minus surrounding whitespace)', () => {
  assert.equal(sanitizeMessageText('Hello, World!'), 'Hello, World!');
  assert.equal(sanitizeMessageText('Multi line\nmessage with\ndetail.'), 'Multi line\nmessage with\ndetail.');
});

test('leading and trailing whitespace is trimmed', () => {
  assert.equal(sanitizeMessageText('   hi   '), 'hi');
  assert.equal(sanitizeMessageText('\n\nhi\n\n'), 'hi');
});

test('control characters are stripped', () => {
  assert.equal(sanitizeMessageText('\x00h\x07i\x08\x0B\x0C\x1B\x7F'), 'hi');
});

test('CRLF and stray CR are normalized to LF', () => {
  assert.equal(sanitizeMessageText('line1\r\nline2'), 'line1\nline2');
  assert.equal(sanitizeMessageText('line1\rline2'), 'line1\nline2');
});

test('trailing whitespace on lines is collapsed', () => {
  assert.equal(sanitizeMessageText('line1   \nline2'), 'line1\nline2');
  assert.equal(sanitizeMessageText('line1\t\nline2'), 'line1\nline2');
});

test('non-string input is rejected', () => {
  assert.equal(sanitizeMessageText(null as unknown as string), null);
  assert.equal(sanitizeMessageText(undefined as unknown as string), null);
  assert.equal(sanitizeMessageText(42 as unknown as string), null);
});

test('case-insensitive scheme detection', () => {
  assert.equal(sanitizeMessageText('JaVaScRiPt:alert(1)'), null);
  assert.equal(sanitizeMessageText('DATA:text/html,evil'), null);
});

test('empty string is preserved as empty string (not null)', () => {
  assert.equal(sanitizeMessageText(''), '');
  assert.equal(sanitizeMessageText('   '), '');
});
