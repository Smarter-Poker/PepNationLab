const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createSuperAgent() {
  const email = "SavageBrands@pepnationlab.com";
  const password = "MyKingDaniel";
  const fullName = "Savage Brands";
  const slug = "savagebrands";

  // Fetch user if they already exist
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === email.toLowerCase());
  const userId = user.id;

  // 2. Upsert Profile
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    email: email.toLowerCase(),
    full_name: fullName,
    role: 'agent',
    is_super_agent: true,
    tier: 'tier_3',
    credit_limit: 100000.00,
    prepaid_balance: 0.00,
    created_at: new Date().toISOString()
  });

  if (profileError) {
    console.error("Profile Error:", profileError);
    return;
  }

  // 3. Upsert Agent Profile
  const { error: agentProfileError } = await supabase.from('agent_profiles').upsert({
    id: userId,
    slug: slug,
    display_name: fullName,
    is_active: true,
    created_at: new Date().toISOString()
  });

  if (agentProfileError) {
    console.error("Agent Profile Error:", agentProfileError);
    return;
  }

  console.log("[OK] Successfully created Super Agent account: SavageBrands / MyKingDaniel");
}

createSuperAgent();
