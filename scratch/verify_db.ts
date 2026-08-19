import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: products } = await supabase.from('agent_products').select('id, custom_image_url, products!inner(id, name)').limit(5);
  for (const p of products || []) {
      console.log(`Product: ${(p.products as any).name}, Image: ${p.custom_image_url}`);
  }
}
main();
