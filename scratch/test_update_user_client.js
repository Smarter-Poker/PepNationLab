const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});
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
  
  const { data: authData } = await admin.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true
  });
  
  console.log("Logging in...");
  const { data: sessionData } = await client.auth.signInWithPassword({
    email,
    password: oldPassword
  });
  
  const userClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  await userClient.auth.setSession(sessionData.session);
  
  console.log("Updating password using client-level auth.updateUser...");
  const { data: updateData, error: updateError } = await userClient.auth.updateUser({
    password: newPassword
  });
  
  if (updateError) {
    console.error("updateUser Error:", updateError);
    return;
  }
  console.log("updateUser success!");

  console.log("Testing if session is still valid...");
  const { data: { user: postUpdateUser }, error: postUpdateError } = await userClient.auth.getUser();
  if (postUpdateError) {
    console.error("getUser Error after updateUser:", postUpdateError);
  } else {
    console.log("getUser after updateUser returned:", postUpdateUser?.email);
  }

  // Clean up
  await admin.auth.admin.deleteUser(authData.user.id);
}
test();
