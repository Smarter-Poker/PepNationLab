import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Find the DEFAULT_STORE_SLUG 
  const { data: defaultStore } = await supabase
    .from('agent_profiles')
    .select('id, slug, display_name')
    .limit(3);
  console.log('First 3 agent profiles (looking for house store):', JSON.stringify(defaultStore, null, 2));

  // Find the lib/default-store to see the slug
  const fs = await import('fs');
  const content = fs.readFileSync('/Users/smarter.poker/Documents/pepnationlab/lib/default-store.ts', 'utf8');
  console.log('default-store.ts:', content);
}
main().catch(console.error);
