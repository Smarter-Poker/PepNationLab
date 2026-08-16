import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('Searching for David Dapper...');
  const { data: users, error: sErr } = await supabase.from('profiles').select('*').ilike('full_name', '%dapper%');
  if (sErr) throw sErr;

  console.log(`Found ${users?.length || 0} users.`);
  if (users) {
    for (const u of users) {
      console.log(`Deleting ${u.full_name} (${u.id})`);
      // First delete from auth.users (which cascades to profiles)
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.error('Failed to delete from auth:', delErr);
        // Fallback: delete from profiles directly
        await supabase.from('profiles').delete().eq('id', u.id);
      } else {
        console.log('Deleted auth user successfully.');
      }
    }
  }
}
main().catch(console.error);
