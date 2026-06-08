const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('products')
    .select('name, category')
    .limit(1000);
  
  if (error) {
    console.error(error);
    return;
  }
  
  const stacks = data.filter(d => d.category === 'Peptide Stacks' || d.category === 'Weight Loss & Metabolism');
  console.log(stacks.map(s => s.name));
}

run();
