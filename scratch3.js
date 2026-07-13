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
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error) { console.error(error); return; }
  console.log(Object.keys(data[0]));
}
run();
