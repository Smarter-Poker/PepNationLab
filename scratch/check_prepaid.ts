import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: adam } = await supabase.from('profiles').select('*').eq('full_name', 'Adam Donnahue').single();
  console.log("Adam's account_type:", adam?.account_type);
  const { data: agent78 } = await supabase.from('profiles').select('*').eq('id', '78edf4f1-9cef-4fba-b974-537213b1b87b').single();
  console.log("Agent 78 account_type:", agent78?.account_type, "parent_agent_id:", agent78?.parent_agent_id);
}

main().catch(console.error);
