import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: users, error: sErr } = await supabase.from('profiles').select('*').ilike('full_name', '%dapper%');
  if (sErr) throw sErr;

  if (users) {
    for (const u of users) {
      console.log(`Deleting ${u.full_name} (${u.id})`);
      
      await supabase.from('profiles').update({ created_by_agent_id: null }).eq('created_by_agent_id', u.id);
      
      const { error: pErr } = await supabase.from('profiles').delete().eq('id', u.id);
      if (pErr) console.error('Failed to delete profile:', pErr.message);
      else console.log('Deleted profile successfully');
    }
  }
}
main().catch(console.error);
