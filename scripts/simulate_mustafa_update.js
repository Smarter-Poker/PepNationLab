// Simulate exactly what the route does for Mustafa updating his own profile:
// first_name, last_name, phone sent from ProfileGateModal
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// We use service role but SET local role to 'authenticated' to simulate the trigger check
const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function test() {
  // The route builds updates as {first_name, last_name, phone, full_name}
  const updates = {
    first_name: 'Mustafa',
    last_name: 'Abuajaj',
    phone: '708-539-2751',
    full_name: 'Mustafa Abuajaj'
  };

  // Use the rpc to set role then update -- this simulates the authenticated context
  // Actually PostgREST does SET LOCAL role = 'authenticated' internally for authenticated requests.
  // We can test by using a custom RPC that does this.
  
  // But the service role key bypasses RLS AND the role setting.
  // The key issue is: with service role, current_setting('role') returns 'service_role', not 'authenticated'.
  // So protect_profile_columns doesn't pin columns, and enforce_researcher_agent_binding is SECURITY DEFINER.
  
  // Let me verify Mustafa's update works with service role (which bypasses everything):
  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', 'f2b0ede4-0f29-4bfc-9555-bcd3cac5e31f')
    .select('id, first_name, last_name, phone, referring_agent_id')
    .maybeSingle();
  
  console.log('Service role result:', { data, error });
  
  // Now, try with RLS bypassed but role set as 'authenticated'
  // We need to use SET LOCAL role = 'authenticated' but this isn't directly accessible via JS SDK.
  // I need to test via an RPC that sets the role.
}
test();
