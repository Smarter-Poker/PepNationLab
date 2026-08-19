import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const { data: products } = await supabase.from('agent_products').select('id, custom_image_url, products!inner(id, name)').eq('agent_id', agent?.id).limit(10);
  
  for (const ap of products || []) {
      const prod: any = ap.products;
      console.log(`Product: "${prod.name}", PNG: ${ap.custom_image_url}`);
  }
}
main();
