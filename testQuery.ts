import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data } = await supabase.from('products').select('name, category_id, categories(slug)').in('name', ['VIP', 'SS-31', 'Melatonin', 'BAC Water', 'Acetic Acid 0.6%']);
  console.log(JSON.stringify(data, null, 2));
}
run();
