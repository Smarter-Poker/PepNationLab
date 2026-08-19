import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: savage } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  
  // Find the product ID for KLOW STACK
  const { data: klowProduct } = await supabase.from('products').select('id').ilike('name', '%KLOW STACK%').single();
  if (!klowProduct) {
      console.log("Could not find KLOW STACK product");
      return;
  }

  // Update ALL agent_products for KLOW STACK
  const { error } = await supabase.from('agent_products')
    .update({ custom_image_url: '/images/savage-brands/klow-tb10-bpc10-ghk50-kpv10-k80.png' })
    .eq('product_id', klowProduct.id);
    
  console.log("Updated KLOW STACK images. Error:", error);
}
main();
