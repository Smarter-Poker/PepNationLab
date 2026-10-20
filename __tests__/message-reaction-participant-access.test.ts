import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({
  user: { id: 'viewer' } as { id: string } | null,
  parent: { sender_id: 'viewer', receiver_id: 'recipient' } as { sender_id: string; receiver_id: string } | null,
  parentError: null as unknown,
  childCalls: [] as Array<{ operation: string; payload?: unknown; filters: unknown[] }>,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({}),
  createServiceClient: async () => ({ from(table: string) {
    if (table === 'internal_messages') return {
      select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: state.parent, error: state.parentError }; },
    };
    if (table !== 'message_reactions') throw new Error('Unexpected Table');
    const entry = { operation: '', filters: [] as unknown[], payload: undefined as unknown };
    const query = {
      select() { entry.operation = 'select'; state.childCalls.push(entry); return this; },
      insert(payload: unknown) { entry.operation = 'insert'; entry.payload = payload; state.childCalls.push(entry); return Promise.resolve({ error: null }); },
      delete() { entry.operation = 'delete'; state.childCalls.push(entry); return this; },
      eq(column: string, value: unknown) { entry.filters.push([column, value]); return this; },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [], error: null }).then(resolve); },
    };
    return query;
  } }),
}));
vi.mock('@/lib/impersonation', () => ({ getEffectiveUser: async () => ({ data: { user: state.user } }) }));
vi.mock('@/lib/csrf', () => ({ assertSameOrigin: () => null }));
import { GET, POST, DELETE } from '@/app/api/messages/reactions/route';
const messageId = '10000000-0000-0000-0000-000000000001';
function request(method: string, id = messageId) {
  return new Request(`https://example.test/api/messages/reactions?messageId=${id}`, {
    method, ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: id, emoji: 'test', user_id: 'forged' }) }),
  }) as NextRequest;
}
beforeEach(() => { state.user = { id: 'viewer' }; state.parent = { sender_id: 'viewer', receiver_id: 'recipient' }; state.parentError = null; state.childCalls = []; });
describe('Reaction Route Participant Authorization', () => {
  for (const [method, handler] of [['GET', GET], ['POST', POST], ['DELETE', DELETE]] as const) {
    it(`${method} Refuses Unrelated Parent Before Any Service Child Query`, async () => {
      state.parent = { sender_id: 'other', receiver_id: 'unrelated' };
      expect((await handler(request(method))).status).toBe(404);
      expect(state.childCalls).toHaveLength(0);
    });
    it(`${method} Refuses Missing Parent And Parent Errors`, async () => {
      state.parent = null;
      expect((await handler(request(method))).status).toBe(404);
      state.parentError = { message: 'Unavailable' };
      expect((await handler(request(method))).status).toBe(500);
      expect(state.childCalls).toHaveLength(0);
    });
    it(`${method} Requires Authentication`, async () => {
      state.user = null;
      expect((await handler(request(method))).status).toBe(401);
      expect(state.childCalls).toHaveLength(0);
    });
    it(`${method} Allows The Sender And Recipient`, async () => {
      for (const id of ['viewer', 'recipient']) {
        state.user = { id };
        expect((await handler(request(method))).status).toBe(200);
      }
      expect(state.childCalls).toHaveLength(2);
    });
  }
  it('Post Ignores Forged Actor And Delete Stays Owner Scoped', async () => {
    await POST(request('POST'));
    expect(state.childCalls[0].payload).toEqual({ message_id: messageId, user_id: 'viewer', emoji: 'test' });
    await DELETE(request('DELETE'));
    expect(state.childCalls[1].filters).toContainEqual(['user_id', 'viewer']);
  });
});
