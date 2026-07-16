import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: adamProfile } = await supabase
    .from('profiles')
    .select('*')
    .ilike('full_name', '%Adam%')
    .single();

  console.log('Adam Profile:', adamProfile?.id, adamProfile?.full_name);

  if (adamProfile) {
    const { data: subagents } = await supabase
      .from('profiles')
      .select('*')
      .eq('parent_agent_id', adamProfile.id);
    console.log('Adam Subagents:', subagents?.map(s => ({ id: s.id, name: s.full_name })));
  }

  const { data: lisaProfile } = await supabase
    .from('profiles')
    .select('*')
    .ilike('full_name', '%Lisa%Anderson%')
    .single();

  console.log('Lisa Profile:', lisaProfile?.id, lisaProfile?.full_name);
}

main().catch(console.error);
