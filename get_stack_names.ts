import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: p1 } = await supabase.from('products').select('id, name').eq('compound_slug', 'cagrisema');
  console.log("CagriSema Products:");
  p1?.forEach(p => console.log(" - " + p.name));

  const { data: p2 } = await supabase.from('products').select('id, name').eq('compound_slug', 'cjc-ipamorelin');
  console.log("\nCJC/IPA Products:");
  p2?.forEach(p => console.log(" - " + p.name));
}
main();
