import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { count } = await supabase
    .from('agent_products')
    .select('*', { count: 'exact', head: true })
    .like('custom_image_url', '%.jpg');
  console.log("Count of .jpg:", count);

  const { count: countPng } = await supabase
    .from('agent_products')
    .select('*', { count: 'exact', head: true })
    .like('custom_image_url', '%.png');
  console.log("Count of .png:", countPng);
}
main();
