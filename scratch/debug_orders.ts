import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: orders } = await supabase.from('orders')
    .select('id, agent_id, total, status, created_at, agent_approved_at')
    .gte('created_at', '2026-07-15T00:00:00Z')
    .neq('status', 'cancelled');
    
  console.log(orders);
  
  const { data: statements } = await supabase.from('weekly_statements').select('*').eq('week_start', '2026-07-13');
  console.log("Statements:", statements);
}

main().catch(console.error);
