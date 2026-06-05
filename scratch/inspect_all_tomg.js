const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';
const supabase = createClient(url, key);

const tomgId = 'dab132ed-c949-4ba9-b051-a79d6227edbf';
const tomId = '3c7df977-500d-4d93-9603-66b57ca81494';

const tables = [
  'researcher_notes', 'researcher_comparisons', 'researcher_doses', 'researcher_biometrics',
  'reconstitution_logs', 'user_saved_compounds', 'user_reading_queue', 'user_compound_subscriptions',
  'user_saved_matches', 'research_match_analytics', 'disclaimer_acceptances', 'orders',
  'notifications', 'researcher_recently_viewed', 'researcher_favorites', 'push_subscriptions'
];

async function runForUser(userId, name) {
  console.log(`\n=== Checking data for ${name} (${userId}) ===`);
  for (const t of tables) {
    try {
      let query = supabase.from(t).select('*', { count: 'exact', head: true });
      // We try to filter by different columns
      let filterColumn = 'user_id';
      if (t === 'researcher_notes' || t === 'researcher_comparisons' || t === 'researcher_doses' || t === 'researcher_biometrics') {
        filterColumn = 'researcher_id';
      } else if (t === 'reconstitution_logs') {
        filterColumn = 'user_id';
      } else if (t === 'orders') {
        filterColumn = 'buyer_id';
      }
      
      const { count, error } = await query.eq(filterColumn, userId);
      if (error) {
        // Fallback to checking other columns if user_id/researcher_id is not present
        const altCols = ['user_id', 'researcher_id', 'buyer_id'].filter(c => c !== filterColumn);
        let found = false;
        for (const c of altCols) {
          const { count: count2, error: error2 } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq(c, userId);
          if (!error2) {
            console.log(`Table ${t} (${c}): count = ${count2}`);
            if (count2 > 0) {
              const { data } = await supabase.from(t).select('*').eq(c, userId);
              console.log(data);
            }
            found = true;
            break;
          }
        }
        if (!found) {
          console.log(`Table ${t}: error ${error.message}`);
        }
      } else {
        console.log(`Table ${t} (${filterColumn}): count = ${count}`);
        if (count > 0) {
          const { data } = await supabase.from(t).select('*').eq(filterColumn, userId);
          console.log(data);
        }
      }
    } catch (e) {
      console.log(`Table ${t} error: ${e.message}`);
    }
  }
}

async function run() {
  await runForUser(tomgId, 'TomG');
  await runForUser(tomId, 'Tom');
}
run();
