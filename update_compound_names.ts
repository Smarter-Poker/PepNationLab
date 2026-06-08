import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  await supabase.from('compounds').update({ display_name: 'The Wolverine Stack' }).eq('slug', 'bpc-tb');
  await supabase.from('compounds').update({ display_name: 'The Fountain of Youth Stack' }).eq('slug', 'cjc-ipamorelin');
  await supabase.from('compounds').update({ display_name: 'The Appetite Crusher Stack' }).eq('slug', 'cagrisema');
  console.log("Updated compounds table!");
}
main();
