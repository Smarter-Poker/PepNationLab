import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createSuperAgent() {
  const email = "SavageBrands@pepnationlab.com";
  const password = "MyKingDaniel";
  const fullName = "Savage Brands";
  const slug = "savagebrands";

  console.log(`Creating user ${email}...`);
  
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes("already exists")) {
      console.log("User already exists, fetching ID...");
    } else {
      console.error("Auth Error:", authError);
      return;
    }
  }

  // Fetch user if they already exist
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === email.toLowerCase());

  if (!user) {
    console.error("Could not find user after creation");
    return;
  }

  const userId = user.id;
  console.log(`User ID: ${userId}`);

  // 2. Upsert Profile
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    email: email.toLowerCase(),
    full_name: fullName,
    role: 'agent',
    is_super_agent: true,
    tier: 'Titan',
    credit_limit: 100000.00,
    credit_balance: 0.00,
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

  console.log("✅ Successfully created Super Agent account: SavageBrands / MyKingDaniel");
}

createSuperAgent();
