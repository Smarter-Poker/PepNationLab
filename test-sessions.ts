import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  if (!users || users.length === 0) return;
  const { data, error } = await supabase.auth.admin.listUserSessions(users[0].id);
  console.log("Sessions:", data);
}
main();
