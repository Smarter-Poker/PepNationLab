require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
  const issues = [];
  console.log("Starting Deep Dive DB Audit...");

  // 1. Commission Percentages
  const { data: commProfiles } = await supabase.from('profiles')
    .select('id, role, commission_pct')
    .in('role', ['agent', 'super_agent', 'sub_agent', 'admin']);
  for (const p of commProfiles || []) {
    if (p.commission_pct !== null && (p.commission_pct < 0 || p.commission_pct > 100)) {
      issues.push(`Out of bounds commission_pct: ${p.id} (${p.commission_pct})`);
    }
  }

  // 2. Sub-agent Mappings
  const { data: subAgents } = await supabase.from('profiles')
    .select('id, parent_agent_id')
    .eq('role', 'sub_agent');
  for (const sa of subAgents || []) {
    if (!sa.parent_agent_id) {
      issues.push(`Sub-agent missing parent_agent_id: ${sa.id}`);
    } else {
      const { data: parent } = await supabase.from('profiles').select('id, role').eq('id', sa.parent_agent_id).single();
      if (!parent) issues.push(`Sub-agent parent not found: ${sa.id} -> ${sa.parent_agent_id}`);
      else if (!['admin', 'super_agent', 'agent'].includes(parent.role)) {
        issues.push(`Sub-agent parent has invalid role: ${sa.id} -> ${parent.role}`);
      }
    }
  }

  // 3. Agent Profile Integrity
  const { data: agents } = await supabase.from('profiles')
    .select('id, role')
    .in('role', ['agent', 'super_agent', 'sub_agent', 'admin']);
  for (const a of agents || []) {
    const { data: ap } = await supabase.from('agent_profiles').select('id').eq('id', a.id).maybeSingle();
    if (!ap) {
      issues.push(`Agent missing agent_profiles row: ${a.id} (${a.role})`);
    }
  }

  // 4. Auth.users email vs Profiles email
  const { data: allProfiles } = await supabase.from('profiles').select('id, email, contact_email, role, account_type, credit_limit, prepaid_balance');
  for (const p of allProfiles || []) {
    const { data: u } = await supabase.auth.admin.getUserById(p.id);
    if (!u || !u.user) {
      issues.push(`Profile has no auth.users record: ${p.id}`);
      continue;
    }
    // Only check emails if profiles.email is populated
    if (p.email && u.user.email !== p.email && p.email !== u.user.email?.replace('.auth', '')) {
      // In some internal auth setups, the email is synthetic.
      if (!u.user.email?.includes('internal.auth')) {
        issues.push(`Email mismatch for ${p.id}: auth=${u.user.email} db=${p.email}`);
      }
    }
  }

  // 5. Check missing slugs
  const { data: noSlugAps } = await supabase.from('agent_profiles').select('id').is('slug', null);
  if (noSlugAps?.length) {
    issues.push(`Agent profiles missing slug: ${noSlugAps.length}`);
  }

  console.log("Audit complete. Issues found:", issues.length);
  if (issues.length) console.log(issues.join('\n'));
}

runAudit().catch(console.error);
