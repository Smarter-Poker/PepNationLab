import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn((_url: string, _key: string, _options: unknown) => ({ isolated: true })) }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
const isolatedRef = 'abcdefghijklmnopqrst';

beforeEach(() => {
  vi.resetModules();
  createClient.mockClear();
  vi.stubEnv('SUPABASE_URL', `https://${isolatedRef}.supabase.co`);
  vi.stubEnv('SUPABASE_TEST_PROJECT_REF', isolatedRef);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'isolated-test-credential');
});
afterEach(() => vi.unstubAllEnvs());

describe('the actual fixture helper refuses unsafe discovery before any client exists', () => {
  it.each(['ydsaqnnuwyvtyxgvrnys', 'kuklfnapbkmacvwxktbh', 'cupnhfdwveouenutnveg'])('refuses production %s', async (ref) => {
    vi.stubEnv('SUPABASE_URL', `https://${ref}.supabase.co`);
    vi.stubEnv('SUPABASE_TEST_PROJECT_REF', ref);
    await expect(import('./db/_helpers')).rejects.toThrow(/Production/);
    expect(createClient).not.toHaveBeenCalled();
  });
  it.each(['SUPABASE_URL', 'SUPABASE_TEST_PROJECT_REF', 'SUPABASE_SERVICE_ROLE_KEY'])('fails rather than skipping without %s', async (key) => {
    vi.stubEnv(key, '');
    await expect(import('./db/_helpers')).rejects.toThrow(/explicitly configured|credential is unavailable/);
    expect(createClient).not.toHaveBeenCalled();
  });
  it('does not use a public production URL fallback', async () => {
    vi.stubEnv('SUPABASE_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ydsaqnnuwyvtyxgvrnys.supabase.co');
    await expect(import('./db/_helpers')).rejects.toThrow(/explicitly configured/);
    expect(createClient).not.toHaveBeenCalled();
  });
  it('allows the explicit isolated target and rechecks before cached client reuse', async () => {
    const fixture = await import('./db/_helpers');
    expect(fixture.ENV_READY).toBe(true);
    expect(createClient).not.toHaveBeenCalled();
    fixture.getServiceClient();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0]?.[0]).toBe(`https://${isolatedRef}.supabase.co`);
    vi.stubEnv('SUPABASE_TEST_PROJECT_REF', 'ydsaqnnuwyvtyxgvrnys');
    expect(() => fixture.getServiceClient()).toThrow(/Production/);
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
