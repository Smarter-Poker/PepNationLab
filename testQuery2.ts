import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data } = await supabase.from('products').select('name, image_url, categories(slug)').in('name', ['The Furnace Stack (L-Carnitine Blend)', 'The Appetite Crusher Stack (Cagrilintide 5mg + Semaglutide 5mg)', 'Glow Stack (TB10 + BPC10 + GHK50)', 'GH Synergy Stack (CJC 5mg + IPA 5mg)']);
  console.log(JSON.stringify(data, null, 2));
}
run();
