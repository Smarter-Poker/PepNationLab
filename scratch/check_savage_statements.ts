import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: stmts, error } = await supabase
    .from('weekly_statements')
    .select('*')
    .eq('agent_id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c') // Savage Brands
    .in('status', ['open', 'pending_payment']);
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Statements:", stmts);

  if (stmts && stmts.length > 0) {
    const ids = stmts.map(s => s.id);
    const { data: stmtOrders, error: orderError } = await supabase
      .from('statement_orders')
      .select('order_id, house_cost, amount_owed')
      .in('statement_id', ids);
    console.log("Statement Orders:", stmtOrders, orderError);
  }
}

run();
