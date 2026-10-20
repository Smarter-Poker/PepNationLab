import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { authorizeMessageReaction } from '../../lib/message-reaction-access.ts';
const message = '10000000-0000-0000-0000-000000000001';
function service(data, error = null) {
  return { from(table) {
    assert.equal(table, 'internal_messages');
    return { select(columns) { assert.equal(columns, 'sender_id, receiver_id'); return this; },
      eq(column, value) { assert.equal(column, 'id'); assert.equal(value, message); return this; },
      async maybeSingle() { return { data, error }; } };
  } };
}
test('Sender And Recipient Can Access Their Message', async () => {
  for (const user of ['sender', 'recipient']) assert.deepEqual(await authorizeMessageReaction(service({ sender_id: 'sender', receiver_id: 'recipient' }), message, user), { status: 200 });
});
test('Service Bypass Does Not Authorize An Unrelated User', async () => {
  assert.equal((await authorizeMessageReaction(service({ sender_id: 'sender', receiver_id: 'recipient' }), message, 'outsider')).status, 404);
});
test('Missing And Unrelated Messages Do Not Disclose Existence', async () => {
  assert.deepEqual(await authorizeMessageReaction(service(null), message, 'outsider'), await authorizeMessageReaction(service({ sender_id: 'sender', receiver_id: 'recipient' }), message, 'outsider'));
});
test('Parent Lookup Error Fails Closed', async () => {
  assert.equal((await authorizeMessageReaction(service(null, { message: 'unavailable' }), message, 'sender')).status, 500);
});
test('Malformed Id Never Reaches The Service Query', async () => {
  for (const value of [null, {}, "id,receiver_id.eq.sender", '']) assert.equal((await authorizeMessageReaction({ from() { throw new Error('Query Should Not Run'); } }, value, 'sender')).status, 400);
});
test('Every Route Authorizes Before Access And Derives Actor From Session', () => {
  const route = readFileSync(new URL('../../app/api/messages/reactions/route.ts', import.meta.url), 'utf8');
  for (const handler of route.split('export async function ').slice(1)) {
    assert.match(handler, /authorizeMessageReaction\(service, messageId, user.id\)/);
    assert.ok(handler.indexOf('if (access.error) return') < handler.indexOf(".from('message_reactions')"));
  }
  assert.match(route, /message_id: messageId, user_id: user.id, emoji/);
  assert.match(route, /\.eq\('user_id', user.id\)/);
});
