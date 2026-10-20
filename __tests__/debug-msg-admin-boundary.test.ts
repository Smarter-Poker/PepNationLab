import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createClient: vi.fn(),
  signMedia: vi.fn(),
  from: vi.fn(), select: vi.fn(), not: vi.fn(), limit: vi.fn(),
}));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/messenger/signMedia', () => ({ signMessengerMediaUrls: mocks.signMedia }));
import { GET } from '@/app/api/debug-msg/route';

beforeEach(() => {
  vi.resetAllMocks();
  const query = { select: mocks.select, not: mocks.not, limit: mocks.limit };
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.not.mockReturnValue(query);
  mocks.limit.mockResolvedValue({ data: [{ id: 'private-message', media_url: 'private-path' }] });
  mocks.createClient.mockReturnValue({ from: mocks.from });
  mocks.signMedia.mockResolvedValue([{ id: 'private-message', media_url: 'signed-private-path' }]);
});

describe('debug messenger media requires admin before service access', () => {
  it.each([401, 403])('returns the existing auth gate %s without querying or signing', async (status) => {
    const denied = NextResponse.json({ error: 'Access denied' }, { status });
    mocks.requireAdmin.mockResolvedValue({ ok: false, response: denied });
    expect(await GET()).toBe(denied);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.signMedia).not.toHaveBeenCalled();
  });
  it('does not expose messages if the authorization check fails', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Authentication unavailable'));
    await expect(GET()).rejects.toThrow('Authentication unavailable');
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.signMedia).not.toHaveBeenCalled();
  });
  it('preserves the authorized response after the admin check completes', async () => {
    let authorized = false;
    mocks.requireAdmin.mockImplementation(async () => { authorized = true; return { ok: true, userId: 'admin' }; });
    mocks.createClient.mockImplementation(() => {
      expect(authorized).toBe(true);
      return { from: mocks.from };
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith('messenger_messages');
    expect(mocks.limit).toHaveBeenCalledWith(1);
    expect(await response.json()).toEqual({
      original: [{ id: 'private-message', media_url: 'private-path' }],
      signed: [{ id: 'private-message', media_url: 'signed-private-path' }],
    });
  });
});
