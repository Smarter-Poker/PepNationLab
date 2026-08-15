import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { CheckoutSchema } from './lib/schemas/order'; // Assuming it's here

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const userId = 'b2ee9bf4-6dd5-41b3-9450-fee51aecb592';
  
  const { data: cart } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!cart) {
    console.log("Cart not found");
    return;
  }
  
  console.log("Cart:", JSON.stringify(cart, null, 2));
}

run();
