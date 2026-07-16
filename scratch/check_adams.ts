import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: adam1 } = await supabase.from('profiles').select('*').eq('full_name', 'Adam Thomas').single();
  const { data: adam2 } = await supabase.from('profiles').select('*').eq('full_name', 'Adam Donnahue').single();

  if (adam1) {
    const { data: subs } = await supabase.from('profiles').select('*').eq('parent_agent_id', adam1.id);
    console.log('Adam Thomas Subs:', subs?.map(s => s.full_name));
  }
  if (adam2) {
    const { data: subs } = await supabase.from('profiles').select('*').eq('parent_agent_id', adam2.id);
    console.log('Adam Donnahue Subs:', subs?.map(s => s.full_name));
  }
}

main().catch(console.error);
