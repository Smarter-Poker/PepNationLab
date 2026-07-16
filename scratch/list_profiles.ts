import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email');
    
  console.log('Profiles:', profiles?.map(p => p.full_name));
}

main().catch(console.error);
