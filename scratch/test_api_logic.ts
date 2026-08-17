import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const FULFILLMENT_COLUMNS = 'id, order_id, product_id, product_name, quantity, unit_retail_price';
  const ADMIN_COLUMNS = 'id, order_id, product_id, product_name, quantity, unit_retail_price, unit_cost_price, unit_super_agent_cost, unit_house_cost, lot_number, coa_url, created_at';

  const orderId = '3c004a00-b1f5-4d77-a5ff-0c85e44e07e4';
  
  const { data: items, error } = await supabase
    .from('order_items')
    .select(ADMIN_COLUMNS)
    .eq('order_id', orderId);

  console.log("Error:", error);
  console.log("Items:", items);
  
  // also get products to map sizes
  const productIds = [...new Set(items?.map((i: any) => i.product_id).filter(Boolean) || [])];
  console.log("Product IDs:", productIds);
  
  if (productIds.length > 0) {
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, unit_size, unit_measure')
      .in('id', productIds);
    console.log("Products Error:", pErr);
    console.log("Products:", products);
  }
}

test();
