import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: carts, error: getErr } = await supabase.rpc('get_abandoned_carts', { p_days: 90 });
  if (getErr) {
    console.error('Error fetching carts:', getErr);
    return;
  }
  
  const sessionsToDelete = [];
  for (const cart of carts) {
    if (cart.user_name !== 'Emily Zielinska') {
        sessionsToDelete.push(cart.session_id);
    }
  }
  
  console.log(`Found ${sessionsToDelete.length} sessions to delete.`);
  console.log(sessionsToDelete);

  if (sessionsToDelete.length > 0) {
      const { data, error } = await supabase.from('agent_storefront_events')
        .delete()
        .in('session_id', sessionsToDelete)
        .eq('event_type', 'add_to_cart');
        
      if (error) console.error('Delete error:', error);
      else console.log('Successfully deleted test carts');
  }
}
run();
