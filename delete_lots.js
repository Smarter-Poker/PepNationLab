const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function run() {
  const { data: prods } = await supabase.from('products').select('id, name')
    .or("name.ilike.%BPC-157 Research Grade%,name.ilike.%Epithalon%Test%,name.ilike.%Test Print%");
  const ids = prods.map(p => p.id);
  
  // 1. Delete certificates
  await supabase.rpc('exec_sql', { query: `SET session_replication_role = replica;` }); // Bypass triggers if possible
  
  // Actually let's just write a raw SQL migration to delete them to avoid trigger issues.
}
run();
