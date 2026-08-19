import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: products } = await supabase.from('agent_products').select('id, custom_image_url')
      .eq('custom_image_url', '/images/savage-brands/the-shred-stack-tirzepatide-aod9604.png');
      
  const promises = [];
  for (const p of products || []) {
      promises.push(
          supabase.from('agent_products').update({ custom_image_url: '/images/savage-brands/savage-shredder-stack.jpg' }).eq('id', p.id)
      );
  }
  await Promise.all(promises);
  console.log(`Updated ${promises.length} shred stacks`);
}
main();
