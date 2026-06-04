const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Update Wolverine
  let res = await supabase.from('products')
    .update({ name: 'The Wolverine Stack (BPC 10mg + TB 10mg)' })
    .eq('name', 'BPC 10mg + TB 10mg')
    .select();
  console.log("Updated Wolverine:", res.data);

  // Update GH Synergy
  res = await supabase.from('products')
    .update({ name: 'The GH Synergy Stack (CJC 5mg + IPA 5mg)' })
    .eq('name', 'CJC-1295 without DAC 5mg + IPA 5mg')
    .select();
  console.log("Updated GH Synergy:", res.data);

  // Update Glow
  res = await supabase.from('products')
    .update({ name: 'The Glow Stack (TB10 + BPC10 + GHK50)' })
    .eq('name', 'GLOW (TB10+BPC10+GHK50)')
    .select();
  console.log("Updated Glow:", res.data);

  // Insert Limitless
  res = await supabase.from('products')
    .insert({
      name: 'The Limitless Stack (Semax + Selank)',
      slug: 'the-limitless-stack-semax-selank',
      category: 'Peptide Stacks',
      is_bundle: true,
      is_active: true,
      in_stock: true,
      base_cost: 65.00,
      description: 'The ultimate cognitive enhancement stack. Combining Semax and Selank for improved focus, memory, and reduced anxiety.',
      image_url: '/images/peptide_clear.png'
    }).select();
  console.log("Inserted Limitless:", res.data);

  // Insert Shred
  res = await supabase.from('products')
    .insert({
      name: 'The Shred Stack (Tirzepatide + AOD9604)',
      slug: 'the-shred-stack-tirzepatide-aod9604',
      category: 'Peptide Stacks',
      is_bundle: true,
      is_active: true,
      in_stock: true,
      base_cost: 120.00,
      description: 'Accelerated fat loss stack combining the powerful GLP-1/GIP dual agonist Tirzepatide with the targeted fat-burning capabilities of AOD9604.',
      image_url: '/images/peptide_clear.png'
    }).select();
  console.log("Inserted Shred:", res.data);
}

run();
