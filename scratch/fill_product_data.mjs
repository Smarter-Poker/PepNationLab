import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...value] = line.split('=');
    env[key] = value.join('=').trim().replace(/^"|'/, '').replace(/"|'$/, '');
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: products, error } = await supabase.from('products').select('*');
  
  if (error) {
    console.error("Fetch error:", error);
    return;
  }
  
  console.log(`Found ${products.length} products. Updating descriptions and images...`);
  
  let updatedCount = 0;
  
  for (const product of products) {
    let updates = {};
    
    if (!product.description || product.description.trim() === '') {
      updates.description = `Highly purified research grade ${product.name}, synthesized under strict quality control standards for in-vitro laboratory use. This compound is designed for experimental models to study cellular pathways, molecular interaction, and receptor affinity. Manufactured with a purity >99%, this formulation ensures consistent, reproducible, and reliable data across multiple analytical assay platforms.`;
    }
    
    if (!product.image_url || product.image_url.trim() === '') {
      updates.image_url = '/images/placeholder_vial.png';
    }
    
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('products')
        .update(updates)
        .eq('id', product.id);
        
      if (updateError) {
        console.error(`Failed to update ${product.name}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }
  
  console.log(`Successfully updated ${updatedCount} products with professional content.`);
}

run();
