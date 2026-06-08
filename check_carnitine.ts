import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: c } = await supabase.from('compounds').select('slug, display_name, is_stack').eq('slug', 'l-carnitine');
  console.log(c);
}
main();
