const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const savageId = 'd89f899f-7c1f-442f-8700-1c39063de2d5'; // Actually let's query it
  const { data: savage } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  console.log("Savage ID:", savage.id);
  
  // Who are the downlines? Let's check agent_relationships. Wait, I saw "agent_relationships" table doesn't exist earlier?
  // Let me just query pg_tables to find the right relationship table name
  const { data: tables } = await supabase.from("information_schema.tables").select("table_name").eq("table_schema", "public").ilike('table_name', '%relation%');
  console.log("Tables with relation:", tables);
  
  const { data: tables2 } = await supabase.from("information_schema.tables").select("table_name").eq("table_schema", "public").ilike('table_name', '%downline%');
  console.log("Tables with downline:", tables2);
  
  const { data: tables3 } = await supabase.from("information_schema.tables").select("table_name").eq("table_schema", "public").ilike('table_name', '%sponsor%');
  console.log("Tables with sponsor:", tables3);
}
run();
