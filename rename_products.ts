import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  await supabase.from('products').update({ name: 'The Wolverine Stack (BPC 5mg + TB 5mg)' }).eq('id', '9442a0fa-4c3f-4edd-8a44-558cfa8b6a32');
  await supabase.from('products').update({ name: 'The Wolverine Stack (BPC 10mg + TB 10mg)' }).eq('id', '5b53db2a-b865-4348-aaea-4d682f184f4d');
  
  // Need to find the ID for Cagrilintide 5mg + Semaglutide 5mg
  const { data: p } = await supabase.from('products').select('id').eq('compound_slug', 'cagrisema');
  if (p && p.length > 0) {
    for (const prod of p) {
      await supabase.from('products').update({ name: 'The Appetite Crusher Stack (Cagrilintide 5mg + Semaglutide 5mg)' }).eq('id', prod.id);
    }
  }

  console.log("Renamed products!");
}
main();
