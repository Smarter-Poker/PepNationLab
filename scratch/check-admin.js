const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Self-contained .env.local parser to avoid installing dotenv dependency
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
      console.warn('.env.local file not found in cwd!');
      return;
    }
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.substring(0, index).trim();
      const val = trimmed.substring(index + 1).trim();
      process.env[key] = val;
    });
  } catch (e) {
    console.error('Error reading env file:', e);
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env variables! URL:', supabaseUrl, 'Key:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const email = 'daniel@bekavactrading.com';
  console.log(`Checking if user ${email} exists in auth.users...`);

  // Querying using service role through auth.admin client
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error listing auth users:', authError);
    return;
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    console.log(`❌ User ${email} does not exist in auth.users! Let's create it.`);
    
    // Create the user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: '215SlalomCt!',
      email_confirm: true,
      user_metadata: { full_name: 'Daniel Bekavac' }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return;
    }

    console.log('✅ User created in auth.users successfully:', newUser.user.id);
    
    // Now let's check or update the profile role
    await updateProfile(newUser.user.id);
  } else {
    console.log('✅ User exists in auth.users with ID:', user.id);
    await updateProfile(user.id);
  }
}

async function updateProfile(userId) {
  console.log(`Checking profile record for user ID ${userId}...`);
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.log('Profile error or missing:', profileError.message);
  }

  console.log('Current profile:', profile);

  console.log(`Upserting profile as Admin role...`);
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: 'daniel@bekavactrading.com',
      role: 'admin',
      tier: 'tier_1', // Admin gets best pricing
      full_name: 'Daniel Bekavac'
    })
    .select();

  if (error) {
    console.error('Error updating profile to admin:', error);
  } else {
    console.log('✅ Profile updated/inserted successfully with admin role:', data);
  }
}

run();
