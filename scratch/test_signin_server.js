const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function test() {
  const email = 'test_temp_user@internal.auth';
  const oldPassword = 'TempPassword123!';
  const newPassword = 'NewPassword123!';
  
  // Clean up if already exists
  const { data: { users } } = await admin.auth.admin.listUsers();
  const existing = users.find(u => u.email === email);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
  }
  
  await admin.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true
  });
  
  // Create a server-like client
  let cookiesSet = {};
  const serverClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  // Now change password via admin
  const existing2 = (await admin.auth.admin.listUsers()).data.users.find(u => u.email === email);
  await admin.auth.admin.updateUserById(existing2.id, { password: newPassword });
  console.log("Password changed via admin.");

  // Log in with new password
  console.log("Logging in via client with new password...");
  const { data: sessionData, error: signInError } = await serverClient.auth.signInWithPassword({
    email,
    password: newPassword
  });
  
  if (signInError) {
    console.error("Sign in Error:", signInError);
  } else {
    console.log("Sign in successful! Session access_token exists:", !!sessionData.session?.access_token);
  }

  // Clean up
  await admin.auth.admin.deleteUser(existing2.id);
}
test();
