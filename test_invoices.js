require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const callerId = "ab2327cb-f58c-4e78-8f9e-899a49259f71"; // Adam

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, is_super_agent, is_sub_agent')
    .eq('id', callerId)
    .single();

  if (!callerProfile || callerProfile.is_sub_agent === true) {
    console.log("Forbidden"); return;
  }

  const { data: invoices, error } = await supabase
    .from('sub_agent_invoices')
    .select(`
      id, week_start, week_end, total_cogs, total_owed, status, created_at,
      profiles!sub_agent_invoices_sub_agent_id_fkey(full_name, email)
    `)
    .eq('super_agent_id', callerId)
    .order('week_start', { ascending: false });

  if (error) console.error("Error:", error.message);
  else console.log("Invoices:", invoices.length);
}

run();
