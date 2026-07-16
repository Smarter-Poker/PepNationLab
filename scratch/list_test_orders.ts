import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: researchers } = await supabase.from('profiles').select('id').eq('role', 'researcher').eq('full_name', 'Test Betsybuyer').limit(1);
  if (!researchers || researchers.length === 0) return;
  const researcherId = researchers[0].id;

  const { data: orders } = await supabase.from('orders').select('*').eq('buyer_id', researcherId);
  console.log('Orders found for Test Betsybuyer:', orders?.length);
  orders?.forEach(o => {
     console.log(`Order ${o.id}: $${o.total} - Status: ${o.status} - Created: ${o.created_at}`);
  });
}

main().catch(console.error);
