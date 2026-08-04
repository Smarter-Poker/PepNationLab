import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.storage.from('print-labels').list();
  if (error) console.error(error);
  else console.log('ROOT:', data.map(f => f.name));
  
  const { data: d2 } = await supabase.storage.from('print-labels').list('savage');
  console.log('SAVAGE:', d2?.map(f => f.name));
}
run();
