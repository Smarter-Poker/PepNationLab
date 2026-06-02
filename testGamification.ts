import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testGamification() {
  console.log('--- Starting Gamification Delta Test ---');
  
  const ts = Date.now();
  console.log('Creating Super Agent (Base 30%, Max 30%)...');
  const r1 = await supabase.auth.admin.createUser({ email: `super_${ts}@test.com`, email_confirm: true, password: 'password123' });
  const superAgentId = r1.data?.user?.id;

  console.log('Creating Sub Agent A (Fixed 10%)...');
  const r2 = await supabase.auth.admin.createUser({ email: `subA_${ts}@test.com`, email_confirm: true, password: 'password123' });
  const subAgentAId = r2.data?.user?.id;

  console.log('Creating Sub Agent B (Scaled Base 10%, Max 25%)...');
  const r3 = await supabase.auth.admin.createUser({ email: `subB_${ts}@test.com`, email_confirm: true, password: 'password123' });
  const subAgentBId = r3.data?.user?.id;

  console.log('Creating Customers...');
  const r4 = await supabase.auth.admin.createUser({ email: `custA_${ts}@test.com`, email_confirm: true, password: 'password123' });
  const customerAId = r4.data?.user?.id;

  const r5 = await supabase.auth.admin.createUser({ email: `custB_${ts}@test.com`, email_confirm: true, password: 'password123' });
  const customerBId = r5.data?.user?.id;

  const u1 = await supabase.from('profiles').upsert({ id: superAgentId, email: `super_${ts}@test.com`, role: 'agent', commission_rate: 30, commission_pct: 30, commission_max_pct: 30, is_active: true });
  if (u1.error) console.error("Upsert superAgent", u1.error);
  
  const u2 = await supabase.from('profiles').upsert({ id: subAgentAId, email: `subA_${ts}@test.com`, role: 'agent', is_sub_agent: true, parent_agent_id: superAgentId, commission_rate: 10, commission_pct: 10, commission_max_pct: 10, commission_active_since: new Date().toISOString(), is_active: true });
  if (u2.error) console.error("Upsert subA", u2.error);

  const u3 = await supabase.from('profiles').upsert({ id: subAgentBId, email: `subB_${ts}@test.com`, role: 'agent', is_sub_agent: true, parent_agent_id: superAgentId, commission_rate: 10, commission_pct: 10, commission_max_pct: 25, commission_active_since: new Date().toISOString(), is_active: true });
  if (u3.error) console.error("Upsert subB", u3.error);

  const u4 = await supabase.from('profiles').upsert({ id: customerAId, email: `custA_${ts}@test.com`, role: 'researcher', referring_agent_id: subAgentAId });
  if (u4.error) console.error("Upsert custA", u4.error);

  const u5 = await supabase.from('profiles').upsert({ id: customerBId, email: `custB_${ts}@test.com`, role: 'researcher', referring_agent_id: subAgentBId });
  if (u5.error) console.error("Upsert custB", u5.error);
  
  const { data: profs } = await supabase.from('profiles').select('id, role').in('id', [superAgentId, subAgentAId, subAgentBId, customerAId, customerBId]);
  console.log("Profiles in DB:", profs);

  // Helper to place and approve an order
  async function placeAndApproveOrder(buyerId: string, agentId: string, subtotal: number, ref: string) {
    console.log(`Placing order ${ref} for $${subtotal}...`);
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      buyer_id: buyerId,
      agent_id: agentId,
      subtotal,
      total: subtotal,
      status: 'pending_customer_payment',
      shipping_cost: 0,
      payment_method: 'zelle'
    }).select().single();
    if (orderErr) {
       console.error("Order error", orderErr);
       return;
    }

    // Approve the order
    console.log(`Approving order ${ref}...`);
    const { error: appErr } = await supabase.from('orders').update({ status: 'approved_ship' }).eq('id', order.id);
    if (appErr) console.error("Approve error", appErr);

    return order.id;
  }

  const orderA = await placeAndApproveOrder(customerAId!, subAgentAId!, 1000, 'TEST-A1');
  const orderB1 = await placeAndApproveOrder(customerBId!, subAgentBId!, 5000, 'TEST-B1'); // Sub B retail = 5000
  const orderB2 = await placeAndApproveOrder(customerBId!, subAgentBId!, 20000, 'TEST-B2'); // Sub B retail = 25000 (Hits max tier or close to it)

  // Verify Commissions
  console.log('Fetching commissions...');
  const { data: subComms, error: subErr } = await supabase.from('sub_agent_commission_ledger').select('*').in('order_id', [orderA, orderB1, orderB2]);
  if (subErr) console.error("Sub Comm Fetch Error:", subErr);
  
  const { data: agentComms, error: agErr } = await supabase.from('agent_commissions').select('*').in('order_id', [orderA, orderB1, orderB2]);
  if (agErr) console.error("Agent Comm Fetch Error:", agErr);
  
  console.log('--- Results ---');
  console.log('Agent Commissions:', agentComms);
  console.log('Sub Agent Commissions:', subComms);

  // Cleanup
  console.log('Cleaning up test data...');
  await supabase.from('sub_agent_commission_ledger').delete().in('order_id', [orderA, orderB1, orderB2]);
  await supabase.from('agent_commissions').delete().in('order_id', [orderA, orderB1, orderB2]);
  await supabase.from('orders').delete().in('id', [orderA, orderB1, orderB2]);
  
  for (const id of [superAgentId, subAgentAId, subAgentBId, customerAId, customerBId]) {
    if (id) await supabase.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log('Cleanup Complete. Done.');
}

testGamification().catch(console.error);
