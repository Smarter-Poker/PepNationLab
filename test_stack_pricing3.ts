import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: p2 } = await supabase.from('products').select('id, name, compound_slug').eq('compound_slug', 'cjc-1295-no-dac-ipamorelin');
  console.log("CJC/IPA products:", p2);
}
main();
