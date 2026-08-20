require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: profiles, error } = await supabase.from('profiles').select('*').not('default_agent_markup_pct', 'is', null);
  if (error) { console.error(error); return; }

  let updated = 0;
  for (const p of profiles) {
    if (p.default_agent_markup_pct == null) continue;
    
    const newMarginRaw = Math.round((((1 + Number(p.default_agent_markup_pct) / 100) / 1.35 - 1) * 100) * 100) / 100;
    const newMargin = Math.max(0, newMarginRaw);
    
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ default_agent_markup_pct: newMargin })
      .eq('id', p.id);
      
    if (upErr) {
      console.error('Failed to update', p.id, upErr.message);
    } else {
      updated++;
    }
  }
  
  console.log(`Successfully reduced default_agent_markup_pct on ${updated} agent profiles.`);
}
run();
