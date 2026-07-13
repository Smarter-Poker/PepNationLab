const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envs = fs.readFileSync('.env.local', 'utf8').split('\n');
let url = '', key = '';
envs.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '');
});

const supabase = createClient(url, key);
async function run() {
  const { data, error } = await supabase.from('products').select('name, unit_size, unit_measure').eq('is_active', true).order('name').order('unit_size');
  if (error) { console.error(error); return; }
  
  const compounds = {};
  data.forEach(d => {
    if (!compounds[d.name]) compounds[d.name] = [];
    const sizeStr = d.unit_size ? `${d.unit_size}${d.unit_measure || ''}` : 'No size';
    compounds[d.name].push(sizeStr);
  });
  
  for (const [name, sizes] of Object.entries(compounds)) {
    // Deduplicate sizes for display
    const uniqueSizes = [...new Set(sizes)];
    // Actually, the prompt says: "IF WE OFFER A PEPTIDE IN MULTIPLE MG SIZES, LIST THOSE AS SEPERATE ONES"
    // So I should just list "Name - Size" for every single active product
  }
  
  data.forEach(d => {
     const sizeStr = d.unit_size ? `${d.unit_size}${d.unit_measure || ''}` : '';
     console.log(`${d.name} ${sizeStr}`.trim());
  });
  console.log(`\nTotal: ${data.length}`);
}
run();
