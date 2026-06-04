const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category')
    .neq('category', 'Peptide Stacks')
    .order('name');
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Total Products (non-stack): ${data.length}`);
  console.log(data.map(d => `${d.name} (${d.category})`).join('\n'));
}

run();
