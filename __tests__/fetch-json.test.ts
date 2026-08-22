import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson } from '@/lib/fetch-json';

/**
 * fetchJson tests: the discriminated result must correctly distinguish success,
 * HTTP error, empty/non-JSON body, and thrown (network/timeout) cases so callers
 * cannot accidentally treat an error body as success data.
 */

function mockFetch(res: Partial<{ ok: boolean; status: number; body: string }>) {
  const { ok = true, status = 200, body = '' } = res;
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => body,
  } as unknown as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchJson', () => {
  it('returns ok + parsed data on 200', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, status: 200, body: JSON.stringify({ data: [1, 2] }) }));
    const r = await fetchJson<{ data: number[] }>('/api/x');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.data).toEqual([1, 2]);
  });

  it('returns ok with null data on an empty 204 body', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, status: 204, body: '' }));
    const r = await fetchJson('/api/x');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBeNull();
  });

  it('surfaces the server error message on a 4xx/5xx', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 422, body: JSON.stringify({ error: 'Nope' }) }));
    const r = await fetchJson('/api/x');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.error).toBe('Nope');
    }
  });

  it('does not throw on a non-JSON HTML error page', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 500, body: '<html>500</html>' }));
    const r = await fetchJson('/api/x');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('500');
  });

  it('returns a network-error result when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const r = await fetchJson('/api/x');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(0);
      expect(r.error).toBe('boom');
    }
  });

  it('maps an AbortSignal TimeoutError to a timeout result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')));
    const r = await fetchJson('/api/x', { timeoutMs: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('Request Timed Out');
  });
});
