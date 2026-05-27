import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = 'shipping@pepnationlab.com';
  const password = '123456';
  const role = 'shipping';
  const fullName = 'Shipping Team';

  console.log(`Creating user: ${email}`);

  // Create Auth User
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already exists')) {
      console.log('User already exists in auth.');
    } else {
      console.error('Failed to create auth user:', authError);
      process.exit(1);
    }
  }

  // Get user ID
  let userId = authData?.user?.id;
  if (!userId) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const existing = users.users.find(u => u.email === email);
    if (!existing) {
      console.error("Could not find user after auth creation failed.");
      process.exit(1);
    }
    userId = existing.id;
  }

  // Update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      full_name: fullName, 
      role: role,
      disclaimer_v1_accepted: true 
    })
    .eq('id', userId);

  if (profileError) {
    console.error('Failed to update profile:', profileError);
    process.exit(1);
  }

  console.log('Successfully created shipping account.');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: ${role}`);
}

main();
