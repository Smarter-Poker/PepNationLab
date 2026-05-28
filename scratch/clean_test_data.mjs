import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...value] = line.split('=');
    env[key] = value.join('=').trim().replace(/^"|'/, '').replace(/"|'$/, '');
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data: profiles, error: fetchError } = await supabase.from('profiles').select('id, email, full_name');
  const testProfiles = profiles.filter(p => (p.full_name && p.full_name.toLowerCase().includes('test')) || (p.email && p.email.toLowerCase().includes('test')));

  for (const p of testProfiles) {
    console.log(`Cleaning up test user: ${p.full_name} ID: ${p.id}`);
    
    // Delete orders
    const { data: orders } = await supabase.from('orders').select('id').eq('buyer_id', p.id);
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      await supabase.from('order_items').delete().in('order_id', orderIds);
      await supabase.from('orders').delete().in('id', orderIds);
    }
    
    // Delete from auth.users
    const { error: delError } = await supabase.auth.admin.deleteUser(p.id);
    if (delError) {
      console.error(`Failed to delete user ${p.id}:`, delError);
    } else {
      console.log(`Successfully deleted user ${p.id}.`);
    }
  }
}
run();
