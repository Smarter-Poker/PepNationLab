const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Insert Limitless
  let res = await supabase.from('products')
    .insert({
      name: 'The Limitless Stack (Semax + Selank)',
      slug: 'the-limitless-stack-semax-selank',
      category: 'Peptide Stacks',
      is_active: true,
      in_stock: true,
      base_cost: 65.00,
      description: 'The ultimate cognitive enhancement stack. Combining Semax and Selank for improved focus, memory, and reduced anxiety.',
      image_url: '/images/peptide_clear.png'
    }).select();
  if(res.error) console.error("Limitless Error:", res.error);
  else console.log("Inserted Limitless:", res.data[0].id);

  // Insert Shred
  res = await supabase.from('products')
    .insert({
      name: 'The Shred Stack (Tirzepatide + AOD9604)',
      slug: 'the-shred-stack-tirzepatide-aod9604',
      category: 'Peptide Stacks',
      is_active: true,
      in_stock: true,
      base_cost: 120.00,
      description: 'Accelerated fat loss stack combining the powerful GLP-1/GIP dual agonist Tirzepatide with the targeted fat-burning capabilities of AOD9604.',
      image_url: '/images/peptide_clear.png'
    }).select();
  if(res.error) console.error("Shred Error:", res.error);
  else console.log("Inserted Shred:", res.data[0].id);
}

run();
