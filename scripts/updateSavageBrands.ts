import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service key to bypass RLS
);

async function run() {
  // 1. Find Savage Brands agent
  const { data: agent, error } = await supabase
    .from('profiles')
    .select('id, username, full_name')
    .ilike('username', '%savage%')
    .single();

  let targetAgent = agent;

  if (!targetAgent) {
    const { data: agent2 } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .ilike('full_name', '%savage%')
      .single();
    targetAgent = agent2;
  }

  if (!targetAgent) {
    console.error('Could not find Savage Brands agent.');
    
    // Let's just dump the users table to see what agents exist
    const { data: users } = await supabase.from('profiles').select('id, username, full_name');
    console.log('Available users:', users);
    return;
  }

  console.log('Found Agent:', targetAgent);

  // 2. Read the actual filenames in public/images/savage-brands
  const files = fs.readdirSync(path.join(process.cwd(), 'public/images/savage-brands'))
    .filter(f => f.endsWith('.jpg'));

  console.log(`Found ${files.length} images in savage-brands folder.`);

  // 3. Get all products to map them
  const { data: products } = await supabase.from('products').select('id, name');
  
  if (!products) {
    console.error('No products found.');
    return;
  }

  let updateCount = 0;

  const hardcodedMap: Record<string, string> = {
    'LL37': 'll-37-5mg.jpg',
    'GHK-CU': 'ghkcu-50mg.jpg',
    'AHK-CU': 'ahkcu-50mg.jpg',
    'TB500 (Thymosin B4 Acetate)': 'tb-500-10mg.jpg',
    'MOTS-C': 'motsc-10mg.jpg',
    'CJC-1295 Without DAC': 'cjc1295-without-dac-10mg.jpg',
    'CJC-1295 With DAC': 'cjc1295-with-dac-5mg.jpg',
    'GHRP-2 Acetate': 'ghrp2-10mg.jpg',
    'GHRP-6 Acetate': 'ghrp6-10mg.jpg',
    'Hexarelin Acetate': 'hexarelin-5mg.jpg',
    'IGF-1LR3': 'igf1-lr3-1mg.jpg',
    'Sermorelin Acetate': 'sermorelin-10mg.jpg',
    'KissPeptin-10': 'kisspeptin10-10mg.jpg',
    'ARA290 (Cibinetide)': 'ara290-10mg.jpg',
    'FOXO4-DRI': 'foxo4dri-10mg.jpg',
    'Thymosin Alpha-1': 'thymosin-alpha1-10mg.jpg',
    'Oxytocin Acetate': 'oxytocin-10mg.jpg',
    'HGH Fragment 176-191': 'hgh-fragment-5mg.jpg',
    // Stacks
    'Shred Stack (Tirzepatide + AOD9604)': 'stack-weight-loss.jpg',
    'GH Synergy Stack (CJC 5mg + IPA 5mg)': 'stack-gh-synergy-1vial.jpg',
    'The Appetite Crusher Stack (Cagrilintide 5mg + Semaglutide 5mg)': 'stack-appetite-crusher-2vial.jpg',
    'Glow Stack (TB10 + BPC10 + GHK50)': 'stack-glow-1vial.jpg',
    'The Furnace Stack (L-Carnitine Blend)': 'stack-furnace-1vial.jpg',
    'The Wolverine Stack (BPC 10mg + TB 10mg)': 'stack-ultimate-recovery.jpg',
    'The Wolverine Stack (BPC 5mg + TB 5mg)': 'stack-ultimate-recovery.jpg',
    'Limitless Stack (Semax + Selank)': 'stack-limitless.jpg',
    'BPC-157 Research Grade': 'bpc-157-research-5mg.jpg',
    'KLOW STACK (TB10+BPC10+GHK50+KPV10)': 'klow-stack-80mg.jpg',
    'The Lipolysis Stack (Lemon Bottle)': 'lipolysis-stack-10ml.jpg',
    'VIP': 'vip-10mg.jpg',
    'Melatonin': 'melatonin-10mg.jpg',
    'SS-31': 'ss-31-10mg.jpg',
    'NAD+': 'nad-100mg.jpg',
    'MT-1': 'mt-1-10mg.jpg',
    'SNAP-8': 'snap-8-10mg.jpg',
    'The Skinny Shot (Lipo-C Blend)': 'skinny-shot-10ml.jpg',
    'BAC Water': 'bac-water.jpg',
    'Acetic Acid 0.6%': 'acetic-acid.jpg',
    'PT-141': 'pt141-10mg.jpg',
  };

  for (const p of products) {
    // Basic normalized name for matching
    const normalizedName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    
    // Find the closest matching file
    let bestMatch = hardcodedMap[p.name] || null;
    if (!bestMatch) {
      for (const f of files) {
        if (f.startsWith(normalizedName)) {
           bestMatch = f;
           break;
        }
      }
    }

    if (bestMatch) {
      const custom_image_url = `/images/savage-brands/${bestMatch}`;
      
      const { data: agentProduct } = await supabase
        .from('agent_products')
        .select('id')
        .eq('agent_id', targetAgent.id)
        .eq('product_id', p.id)
        .maybeSingle();

      if (agentProduct) {
        await supabase
          .from('agent_products')
          .update({ custom_image_url })
          .eq('id', agentProduct.id);
        updateCount++;
        console.log(`Updated ${p.name} -> ${custom_image_url}`);
      } else {
        console.log(`No agent_product found for ${p.name}`);
      }
    } else {
       console.log(`Could not find a matching image for product: ${p.name} (normalized: ${normalizedName})`);
    }
  }

  console.log(`Successfully updated ${updateCount} product images for Savage Brands.`);
}

run();
