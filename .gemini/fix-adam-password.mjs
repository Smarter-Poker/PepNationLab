import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  // Step 1: Find Adam's profile
  console.log('🔍 Step 1: Looking up Adam Thomas profile...');
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, full_name, username, email, role, is_active')
    .ilike('full_name', '%adam%')
    .in('role', ['agent', 'super_agent']);

  if (profileErr) { console.error('❌ Profile lookup error:', profileErr); return; }
  if (!profile?.length) { console.error('❌ No agent named Adam found'); return; }

  console.log('✅ Found profiles:', JSON.stringify(profile, null, 2));

  for (const p of profile) {
    console.log(`\n🔍 Step 2: Checking auth record for ${p.full_name} (${p.id})...`);
    
    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(p.id);
    if (authErr) {
      console.error(`❌ Auth lookup error for ${p.full_name}:`, authErr.message);
      continue;
    }
    if (!authUser?.user) {
      console.error(`❌ NO AUTH RECORD FOUND for ${p.full_name} - this is the bug!`);
      continue;
    }

    console.log(`✅ Auth record exists: email=${authUser.user.email}, confirmed=${authUser.user.email_confirmed_at ? 'yes' : 'no'}`);

    // Step 3: Try updating the password
    const NEW_PASSWORD = 'AdamPep2025!';
    console.log(`\n🔄 Step 3: Attempting password update to "${NEW_PASSWORD}"...`);
    
    const { error: updateErr } = await admin.auth.admin.updateUserById(p.id, { password: NEW_PASSWORD });
    if (updateErr) {
      console.error(`❌ Password update failed:`, updateErr.message, updateErr);
      continue;
    }

    // Step 4: Also write to provisioned_password in profiles
    await admin.from('profiles').update({
      provisioned_password: NEW_PASSWORD,
      must_change_password: false,
      updated_at: new Date().toISOString()
    }).eq('id', p.id);

    console.log(`✅ Password successfully updated for ${p.full_name}!`);
    console.log(`\n📋 LOGIN CREDENTIALS:`);
    console.log(`   Username: ${p.username}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log(`   Auth email: ${authUser.user.email}`);

    // Step 5: Verify by signing in
    console.log(`\n🔍 Step 5: Verifying login works...`);
    const anonClient = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzkzOTIsImV4cCI6MjA5NDk1NTM5Mn0.19bS915TJORh2frCU21Xn92lfa5XF2C26vKGZwjIiDk');
    const { error: signInErr } = await anonClient.auth.signInWithPassword({
      email: authUser.user.email,
      password: NEW_PASSWORD
    });
    if (signInErr) {
      console.error(`❌ Sign-in verification failed:`, signInErr.message);
    } else {
      console.log(`✅ VERIFIED: Sign-in with new password works perfectly!`);
    }
  }
}

run().catch(console.error);
