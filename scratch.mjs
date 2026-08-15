import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const target_id = 'a253044b-2250-4187-9af5-78cbca2d4e67'; // The test_ws_debug admin from my previous script
  
  const { data: profile } = await supabase.from('profiles').select('role, is_admin_account').eq('id', target_id).single();
  console.log('Original:', profile);
  
  if (profile.role === 'admin') {
     console.log('This is a super admin, cannot delete.');
  }
}
main();
