import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { canReadOrderItemCosts } from '../../lib/order-item-cost-access.ts';
function service(parent, error = null) {
  return { from(table) {
    assert.equal(table, 'profiles');
    return { select(columns) { assert.equal(columns, 'parent_agent_id'); return this; },
      eq(column, value) { assert.equal(column, 'id'); assert.equal(value, 'seller'); return this; },
      async maybeSingle() { return { data: parent ? { parent_agent_id: parent } : null, error }; } };
  } };
}
const noQuery = { from() { throw new Error('Query Should Not Run'); } };
test('Researcher Buyer And Shipping Cannot Read Costs', async () => {
  for (const role of ['researcher', 'shipping']) assert.equal(await canReadOrderItemCosts(noQuery, { id: 'seller', role }, 'seller'), false);
});
test('Admin And Actual Selling Agent Retain Costs', async () => {
  assert.equal(await canReadOrderItemCosts(noQuery, { id: 'admin', role: 'admin' }, 'seller'), true);
  assert.equal(await canReadOrderItemCosts(noQuery, { id: 'seller', role: 'agent' }, 'seller'), true);
});
test('Only The Authoritative Direct Parent Gets Hierarchy Access', async () => {
  assert.equal(await canReadOrderItemCosts(service('parent'), { id: 'parent', role: 'super_agent' }, 'seller'), true);
  assert.equal(await canReadOrderItemCosts(service('parent'), { id: 'unrelated-agent', role: 'agent' }, 'seller'), false);
});
test('Missing Seller And Failed Parent Lookup Fail Closed', async () => {
  assert.equal(await canReadOrderItemCosts(noQuery, { id: 'parent', role: 'super_agent' }, null), false);
  assert.equal(await canReadOrderItemCosts(service(null), { id: 'parent', role: 'super_agent' }, 'seller'), false);
  assert.equal(await canReadOrderItemCosts(service('parent', { message: 'failed' }), { id: 'parent', role: 'super_agent' }, 'seller'), false);
});
test('Order Page Reads Safe Session Projection Before Authorized Service Costs', () => {
  const page = readFileSync(new URL('../../app/orders/[id]/page.tsx', import.meta.url), 'utf8');
  const initialQuery = page.slice(page.indexOf('const { data: orderData'), page.indexOf('const order = orderData'));
  assert.doesNotMatch(initialQuery, /unit_cost_price|unit_super_agent_cost|unit_house_cost/);
  assert.match(page, /if \(canViewCosts\) \{[\s\S]*?costService.from\('order_items'\)/);
  assert.match(page, /\{canViewCosts && order.agent_id/);
});
