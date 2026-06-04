const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: cols, error } = await supabase.from('researcher_favorites').select('*').limit(1);
  console.log("Favorites Columns:", Object.keys(cols[0] || {}));
  
  const { data: cols2, error2 } = await supabase.from('researcher_recently_viewed').select('*').limit(1);
  console.log("Recent Columns:", Object.keys(cols2[0] || {}));
}

run();
