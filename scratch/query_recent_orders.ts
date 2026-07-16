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
    .select('id, agent_id, total, status, created_at')
    .gte('created_at', '2026-07-15T00:00:00Z');
  
  console.log(`Found ${orders?.length} orders since Wednesday (July 15).`);
  console.log(orders);
}

main().catch(console.error);
