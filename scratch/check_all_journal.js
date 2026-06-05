const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';
const supabase = createClient(url, key);

async function run() {
  const tables = ['researcher_notes', 'researcher_comparisons', 'researcher_doses', 'researcher_biometrics'];
  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select('*');
      if (error) {
        console.error(`Error fetching ${t}:`, error.message);
      } else {
        console.log(`Table ${t} has ${data.length} records.`);
        if (data.length > 0) {
          console.log(data);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}
run();
