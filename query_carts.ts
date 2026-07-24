import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.from('profiles').select('id, full_name, cart_state');
  if (error) console.error(error);
  else {
    let count = 0;
    data.forEach(p => {
        if (p.cart_state && Array.isArray(p.cart_state) && p.cart_state.length > 0) {
            count++;
            console.log(p.full_name, 'Cart items:', p.cart_state.length);
        } else if (p.cart_state && typeof p.cart_state === 'object' && Object.keys(p.cart_state).length > 0 && !Array.isArray(p.cart_state)) {
            // sometimes it's stored as an object? 
            count++;
            console.log(p.full_name, 'Cart state object length:', Object.keys(p.cart_state).length);
        }
    });
    console.log(`Found ${count} profiles with non-empty carts.`);
  }
}
run();
