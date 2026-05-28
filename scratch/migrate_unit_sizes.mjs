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

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
  const { data: products } = await supabase.from('products').select('id, name, description, unit_size, unit_measure');
  let updated = 0;
  
  for (const p of products) {
    if (p.description && p.description.includes('Specification:')) {
      const match = p.description.match(/Specification:\s*([0-9.]+)\s*([a-zA-Z]+)/i);
      
      let unit_size = null;
      let unit_measure = p.unit_measure;
      
      if (match) {
        unit_size = match[1];
        unit_measure = match[2].toLowerCase();
      } else {
        // Handle variations
        const cleanMatch = p.description.match(/Specification:\s*([0-9.]+[a-zA-Z]+)/i);
        if (cleanMatch) {
          const spec = cleanMatch[1];
          const numMatch = spec.match(/([0-9.]+)/);
          const txtMatch = spec.match(/([a-zA-Z]+)/);
          if (numMatch && txtMatch) {
            unit_size = numMatch[1];
            unit_measure = txtMatch[1].toLowerCase();
          }
        }
      }
      
      const boilerplateDesc = `Highly purified research grade ${p.name}, synthesized under strict quality control standards for in-vitro laboratory use. This compound is designed for experimental models to study cellular pathways, molecular interaction, and receptor affinity. Manufactured with a purity >99%, this formulation ensures consistent, reproducible, and reliable data across multiple analytical assay platforms.`;

      if (unit_size) {
        const { error } = await supabase.from('products').update({
          unit_size: unit_size,
          unit_measure: unit_measure,
          description: boilerplateDesc
        }).eq('id', p.id);
        
        if (!error) {
          updated++;
        } else {
          console.error("Error updating", p.name, error);
        }
      } else {
        // Just update description if we couldn't parse
        await supabase.from('products').update({ description: boilerplateDesc }).eq('id', p.id);
        console.log("Could not parse unit size for", p.name, "— defaulting description.");
      }
    } else {
        // Just update description if it wasn't the Specification string
        const boilerplateDesc = `Highly purified research grade ${p.name}, synthesized under strict quality control standards for in-vitro laboratory use. This compound is designed for experimental models to study cellular pathways, molecular interaction, and receptor affinity. Manufactured with a purity >99%, this formulation ensures consistent, reproducible, and reliable data across multiple analytical assay platforms.`;
        await supabase.from('products').update({ description: boilerplateDesc }).eq('id', p.id);
    }
  }
  
  console.log(`Updated ${updated} products with unit sizes.`);
}
run();
