import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydsaqnnuwyvtyxgvrnys.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI'
);
async function run() {
  const { data, error } = await supabase.from('products').select('id, name, base_cost, retail_price').limit(5);
  console.log("Products:", data);
}
run();
