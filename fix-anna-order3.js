const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const savage = '844dca4b-6f01-4779-bc95-bfa1e0809c0c';
  const orderId = 'a51349d0-b707-479c-ac93-4eeb892d3efd';
  const shortId = orderId.slice(0, 8).toUpperCase();

  const { data: notif, error: notifErr } = await svc.from('notifications').insert({
    user_id: savage,
    title: 'Payment Proof Received',
    body: `Your researcher submitted a payment proof for Order #${shortId}. Review and mark as paid.`,
    type: 'system',
    url: `/dashboard/agent/orders/${orderId}`
  });
  
  console.log("Notification inserted:", notifErr || "Success");
}

run();
