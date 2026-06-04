import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const term = '%BPC%';
  let query = supabase.from('agent_products').select('id, products!inner(id, name)');
  query = query.or(`name.ilike.${term},description.ilike.${term},category.ilike.${term}`, { foreignTable: 'products' });
  const { data, error } = await query;
  if (error) {
    console.error("SUPABASE ERROR:", error);
  } else {
    console.log("SUCCESS, rows:", data.length);
  }
}
run();
