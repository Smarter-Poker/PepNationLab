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
  
  console.log("1. Creating test user...");
  // Clean up if already exists
  const { data: { users } } = await admin.auth.admin.listUsers();
  const existing = users.find(u => u.email === email);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
  }
  
  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true
  });
  
  if (createError) {
    console.error("Create Error:", createError);
    return;
  }
  
  const userId = authData.user.id;
  console.log("User created with ID:", userId);
  
  console.log("2. Logging in with old (temp) password...");
  const { data: sessionData, error: loginError } = await client.auth.signInWithPassword({
    email,
    password: oldPassword
  });
  
  if (loginError) {
    console.error("Login Error:", loginError);
    return;
  }
  
  const userClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  // Set session on the client
  await userClient.auth.setSession(sessionData.session);
  
  console.log("3. Verifying we can get user...");
  const { data: { user: initialUser } } = await userClient.auth.getUser();
  console.log("Got user:", initialUser?.email);
  
  console.log("4. Updating password via admin client...");
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword
  });
  
  if (updateError) {
    console.error("Update Error:", updateError);
    return;
  }
  console.log("Password updated successfully!");
  
  console.log("5. Testing if old session is still valid...");
  const { data: { user: postUpdateUser }, error: postUpdateError } = await userClient.auth.getUser();
  if (postUpdateError) {
    console.error("getUser Error after password change:", postUpdateError);
  } else {
    console.log("getUser after password change returned:", postUpdateUser?.email);
  }
  
  // Clean up
  await admin.auth.admin.deleteUser(userId);
}
test();
