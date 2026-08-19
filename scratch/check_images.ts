import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: products } = await supabase.from('products').select('id, name, image_url');
  let missingCount = 0;
  for (const p of products || []) {
    if (p.image_url && p.image_url.startsWith('/images/products/')) {
      const filePath = path.join(process.cwd(), 'public', p.image_url);
      if (!fs.existsSync(filePath)) {
        console.log(`Missing product image: ${p.image_url}`);
        missingCount++;
      }
    }
  }
  console.log(`Total missing product images: ${missingCount}`);

  const { data: agentProducts } = await supabase.from('agent_products').select('id, custom_image_url').not('custom_image_url', 'is', null);
  let missingAgentCount = 0;
  for (const p of agentProducts || []) {
    if (p.custom_image_url && p.custom_image_url.startsWith('/images/')) {
      const filePath = path.join(process.cwd(), 'public', p.custom_image_url);
      if (!fs.existsSync(filePath)) {
        console.log(`Missing agent image: ${p.custom_image_url}`);
        missingAgentCount++;
      }
    }
  }
  console.log(`Total missing agent images: ${missingAgentCount}`);
}
main().catch(console.error);
