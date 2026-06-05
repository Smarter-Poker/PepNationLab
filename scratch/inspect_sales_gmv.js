const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';
const supabase = createClient(url, key);

async function run() {
  console.log('--- Querying all orders ---');
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, buyer_id, total, status, created_at');
  
  if (ordersError) {
    console.error('Error fetching orders:', ordersError.message);
    return;
  }
  
  console.log(`Found ${orders.length} orders in total:`);
  console.log(orders);
  
  console.log('\n--- Querying profiles of buyers ---');
  const buyerIds = [...new Set(orders.map(o => o.buyer_id))].filter(Boolean);
  if (buyerIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, role, display_name')
      .in('id', buyerIds);
      
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError.message);
    } else {
      console.log('Profiles associated with these orders:');
      console.log(profiles);
    }
  } else {
    console.log('No buyer IDs found in orders.');
  }
}

run();
