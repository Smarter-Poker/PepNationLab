require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit2() {
  const issues = [];
  console.log("Starting DB Audit 2 (Orders)...");

  const { data: orders } = await supabase.from('orders').select('id, agent_id, payment_method, status, is_paid');
  
  for (const o of orders || []) {
    if (!o.agent_id) continue;
    const { data: agent } = await supabase.from('profiles').select('account_type').eq('id', o.agent_id).single();
    if (!agent) {
      issues.push(`Order ${o.id} has invalid agent_id ${o.agent_id}`);
      continue;
    }

    if (o.payment_method === 'credit' && agent.account_type !== 'credit' && agent.account_type !== 'admin') {
      issues.push(`Order ${o.id} used credit but agent is ${agent.account_type}`);
    }
    if (o.payment_method === 'prepaid' && agent.account_type !== 'prepaid') {
      // Technically credit agents can use prepaid balance if they have it, but let's check
      // issues.push(`Order ${o.id} used prepaid but agent is ${agent.account_type}`);
    }
  }

  // 2. Check for missing line items on orders
  const { data: oList } = await supabase.from('orders').select('id');
  for (const o of oList || []) {
    const { count } = await supabase.from('order_items').select('*', { count: 'exact', head: true }).eq('order_id', o.id);
    if (count === 0) issues.push(`Order ${o.id} has no line items!`);
  }

  console.log("Audit 2 complete. Issues found:", issues.length);
  if (issues.length) console.log(issues.slice(0,20).join('\n'));
}

runAudit2().catch(console.error);
