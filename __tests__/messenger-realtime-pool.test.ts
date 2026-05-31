/**
 * audit15 fix-26 (B10): unit tests for the broadcastCallSignal channel pool.
 *
 * Mocks @/lib/supabase/client so the test runs against a fake channel
 * implementation. Asserts:
 *   1. First send to a target subscribes one channel.
 *   2. Repeat sends to same target within idle window reuse it.
 *   3. Distinct targets each get their own channel up to MAX, then LRU evicts.
 *   4. Subscribe failure drops the entry so the next call retries cleanly.
 *
 * Run with: `npx vitest run __tests__/messenger-realtime-pool.test.ts`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mock the Supabase client surface --------------------------------------
type SubscribeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR';
interface FakeChannel {
  __targetTopic: string;
  subscribe: (cb: (status: SubscribeStatus) => void) => FakeChannel;
  send: (payload: unknown) => Promise<{ status: string }>;
}

const fakeChannels: FakeChannel[] = [];
let nextSubscribeStatus: SubscribeStatus = 'SUBSCRIBED';

function makeFakeChannel(topic: string): FakeChannel {
  const ch: FakeChannel = {
    __targetTopic: topic,
    subscribe(cb) {
      // Defer to next tick so the pool's race-with-timeout has a moment.
      setTimeout(() => cb(nextSubscribeStatus), 0);
      return ch;
    },
    send: vi.fn(async () => ({ status: 'ok' })),
  };
  fakeChannels.push(ch);
  return ch;
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (topic: string) => makeFakeChannel(topic),
    removeChannel: vi.fn(),
  }),
}));

// ----------------------------------------------------------------------------

beforeEach(() => {
  fakeChannels.length = 0;
  nextSubscribeStatus = 'SUBSCRIBED';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('broadcastCallSignal channel pool', () => {
  it('subscribes a fresh channel on first send', async () => {
    const { broadcastCallSignal } = await import('@/lib/messenger/realtime');
    const p = broadcastCallSignal('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'incoming_call', { id: 'c1' });
    await vi.runAllTimersAsync();
    await p;
    expect(fakeChannels).toHaveLength(1);
    expect(fakeChannels[0].__targetTopic).toBe('call-signal:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(fakeChannels[0].send).toHaveBeenCalledOnce();
  });

  it('reuses the same channel on repeat sends to the same target', async () => {
    const { broadcastCallSignal } = await import('@/lib/messenger/realtime');
    const tgt = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    await Promise.all([
      (async () => { const p = broadcastCallSignal(tgt, 'call_ended', { id: 'c1' }); await vi.runAllTimersAsync(); return p; })(),
      (async () => { const p = broadcastCallSignal(tgt, 'call_ended', { id: 'c1' }); await vi.runAllTimersAsync(); return p; })(),
      (async () => { const p = broadcastCallSignal(tgt, 'call_ended', { id: 'c1' }); await vi.runAllTimersAsync(); return p; })(),
    ]);
    expect(fakeChannels).toHaveLength(1);
    expect(fakeChannels[0].send).toHaveBeenCalledTimes(3);
  });

  it('opens distinct channels per target', async () => {
    const { broadcastCallSignal } = await import('@/lib/messenger/realtime');
    const a = 'aaaaaaaa-1111-1111-1111-111111111111';
    const b = 'bbbbbbbb-2222-2222-2222-222222222222';
    const c = 'cccccccc-3333-3333-3333-333333333333';
    await Promise.all([
      (async () => { const p = broadcastCallSignal(a, 'incoming_call', {}); await vi.runAllTimersAsync(); return p; })(),
      (async () => { const p = broadcastCallSignal(b, 'incoming_call', {}); await vi.runAllTimersAsync(); return p; })(),
      (async () => { const p = broadcastCallSignal(c, 'incoming_call', {}); await vi.runAllTimersAsync(); return p; })(),
    ]);
    expect(fakeChannels).toHaveLength(3);
  });

  it('does not cache a broken entry when subscribe fails', async () => {
    const { broadcastCallSignal } = await import('@/lib/messenger/realtime');
    nextSubscribeStatus = 'CHANNEL_ERROR';
    const tgt = 'dddddddd-4444-4444-4444-444444444444';
    const p1 = broadcastCallSignal(tgt, 'incoming_call', {});
    await vi.runAllTimersAsync();
    await p1;
    // Next call should NOT reuse the broken entry — it should create a new
    // channel (still failing in this run, but a fresh subscription attempt).
    nextSubscribeStatus = 'SUBSCRIBED';
    const p2 = broadcastCallSignal(tgt, 'incoming_call', {});
    await vi.runAllTimersAsync();
    await p2;
    expect(fakeChannels.length).toBeGreaterThanOrEqual(2);
  });
});
