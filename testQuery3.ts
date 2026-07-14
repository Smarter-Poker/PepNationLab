import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.from('products').select('name, image_url, categories(slug)').ilike('name', '%Stack%');
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
