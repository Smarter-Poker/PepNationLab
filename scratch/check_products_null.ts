import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .is('image_url', null);

  console.log("Count of global products with null image_url:", count);
  
  const { count: countMissing } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('image_url', '');

  console.log("Count of global products with empty image_url:", countMissing);
}
main().catch(console.error);
