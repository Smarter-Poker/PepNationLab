import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const CANONICAL = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';

// getSupabaseUrl reads process.env at call time, so stubbing the env var
// before each call is sufficient; no module re-import is needed.
import { getSupabaseUrl } from '@/lib/supabase/url';

describe('getSupabaseUrl', () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it('returns the env url when it is a normal supabase host', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', CANONICAL);
    expect(getSupabaseUrl()).toBe(CANONICAL);
  });

  it('falls back to canonical when the env var is empty', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(getSupabaseUrl()).toBe(CANONICAL);
  });

  it('falls back to canonical when the env var is whitespace', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '   ');
    expect(getSupabaseUrl()).toBe(CANONICAL);
  });

  it('falls back to canonical when the env var is malformed', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not a url');
    expect(getSupabaseUrl()).toBe(CANONICAL);
  });

  it('routes around the dead vanity host regardless of case', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://AUTH.pepnationlab.com');
    expect(getSupabaseUrl()).toBe(CANONICAL);
  });

  it('strips trailing slashes from a valid env url', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `${CANONICAL}///`);
    expect(getSupabaseUrl()).toBe(CANONICAL);
  });
});
