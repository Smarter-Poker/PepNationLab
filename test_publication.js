const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.rpc('get_realtime_publication_tables');
  if (error) {
    // If rpc doesn't exist, try querying pg_publication_tables
    const { data: pubData, error: pubErr } = await supabase.from('pg_publication_tables').select('*');
    console.log("pg_publication_tables:", pubData, pubErr);
  } else {
    console.log(data);
  }
}
run().catch(console.error);
