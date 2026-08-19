import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, image_url')
    .like('image_url', '%savage-brands%')
    .limit(5);
    
  console.log("Global products with savage-brands paths:");
  console.log(products);

  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .like('image_url', '%savage-brands%');

  console.log("Count:", count);
}
main().catch(console.error);
