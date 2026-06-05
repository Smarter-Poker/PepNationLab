const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ydsaqnnuwyvtyxgvrnys.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI'
);

async function main() {
  const { data: agents, error } = await supabase
    .from('agent_profiles')
    .select('*');
  
  if (error) {
    console.error('Error fetching agent profiles:', error);
  } else {
    console.log('Agent Profiles:', agents);
  }
}

main();
