import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      total, status, created_at,
      order_items ( quantity, unit_cost_price, products ( base_cost ) )
    `)
    .neq('status', 'cancelled')
    .limit(3);

  console.log("Timeseries Query:");
  console.log(error || data);

  const { data: topProducts, error: err2 } = await supabase
      .from('order_items')
      .select(`
        product_name,
        quantity,
        unit_retail_price,
        unit_cost_price,
        products ( base_cost ),
        orders!inner(created_at, status)
      `)
      .neq('orders.status', 'cancelled')
      .limit(3);

  console.log("Top Products Query:");
  console.log(err2 || topProducts);
}

main().catch(console.error);
