const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';
const supabase = createClient(url, key);

async function run() {
  const tomgId = 'dab132ed-c949-4ba9-b051-a79d6227edbf';
  const tomId = '3c7df977-500d-4d93-9603-66b57ca81494';
  
  console.log('--- Inspecting Lab Journal Data for tomg ---');
  for (const table of ['reconstitution_logs', 'researcher_notes', 'researcher_comparisons', 'researcher_doses', 'researcher_biometrics']) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq('researcher_id', tomgId);
      if (error) {
        // Some tables might use user_id or developer_id instead of researcher_id. Let's check error or columns
        const { data: data2, error: error2 } = await supabase.from(table).select('*').eq('user_id', tomgId);
        if (error2) {
          console.log(`Table ${table}: error`, error.message, error2.message);
        } else {
          console.log(`Table ${table} (user_id): count = ${data2.length}`);
          if (data2.length > 0) console.log(data2);
        }
      } else {
        console.log(`Table ${table}: count = ${data.length}`);
        if (data.length > 0) console.log(data);
      }
    } catch (e) {
      console.log(`Table ${table} error:`, e.message);
    }
  }

  console.log('--- Inspecting Lab Journal Data for tom ---');
  for (const table of ['reconstitution_logs', 'researcher_notes', 'researcher_comparisons', 'researcher_doses', 'researcher_biometrics']) {
    try {
      const { data } = await supabase.from(table).select('*').eq('researcher_id', tomId);
      console.log(`Table ${table} (tom): count = ${data ? data.length : 0}`);
      if (data && data.length > 0) console.log(data);
    } catch {}
  }
}
run();
