import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: stmts, error } = await supabase
    .from('weekly_statements')
    .select('id, total_owed, status, agent_id');

  const orphans = [];
  for (const s of stmts) {
    const { count } = await supabase
      .from('statement_orders')
      .select('*', { count: 'exact', head: true })
      .eq('statement_id', s.id);
    if (count === 0 && s.status === 'open') {
      orphans.push(s);
    }
  }
  
  console.log("Orphan open statements:", orphans);
}

run();
