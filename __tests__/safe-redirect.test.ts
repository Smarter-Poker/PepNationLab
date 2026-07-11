import { describe, it, expect } from 'vitest';
import { safeRelativePath } from '@/lib/safe-redirect';

/**
 * Open-redirect guard tests.
 *
 * safeRelativePath backs the post-login / OAuth-callback redirect. It must only
 * allow same-origin relative paths and must strip embedded control characters
 * that browsers would otherwise collapse into a scheme-relative "//host"
 * navigation (a documented past bypass: "/<TAB>//evil.com").
 */
describe('safeRelativePath', () => {
  it('allows clean relative paths', () => {
    expect(safeRelativePath('/dashboard')).toBe('/dashboard');
    expect(safeRelativePath('/admin')).toBe('/admin');
    expect(safeRelativePath('/dashboard/orders?tab=open')).toBe('/dashboard/orders?tab=open');
  });

  it('rejects scheme-relative and backslash forms', () => {
    expect(safeRelativePath('//evil.com')).toBe('/dashboard');
    expect(safeRelativePath('/\\evil.com')).toBe('/dashboard');
  });

  it('rejects absolute URLs with a scheme', () => {
    expect(safeRelativePath('https://evil.com')).toBe('/dashboard');
    expect(safeRelativePath('http://evil.com')).toBe('/dashboard');
    expect(safeRelativePath('javascript:alert(1)')).toBe('/dashboard');
  });

  it('rejects the control-character bypass', () => {
    // decodeURIComponent('/%09//evil.com') === '/\t//evil.com'
    expect(safeRelativePath('/\t//evil.com')).toBe('/dashboard');
    expect(safeRelativePath('/\n//evil.com')).toBe('/dashboard');
    expect(safeRelativePath('/\r//evil.com')).toBe('/dashboard');
  });

  it('falls back on empty / non-string input', () => {
    expect(safeRelativePath(null)).toBe('/dashboard');
    expect(safeRelativePath(undefined)).toBe('/dashboard');
    expect(safeRelativePath('')).toBe('/dashboard');
  });

  it('honors a custom fallback', () => {
    expect(safeRelativePath(null, '/login')).toBe('/login');
    expect(safeRelativePath('//evil.com', '/login')).toBe('/login');
  });
});
