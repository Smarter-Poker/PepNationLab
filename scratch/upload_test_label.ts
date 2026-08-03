import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const sourceJpg = '/Users/smarter.poker/.gemini/antigravity/brain/a19f9938-5124-4d98-ab0e-d8f465f94f69/.tempmediaStorage/media_a19f9938-5124-4d98-ab0e-d8f465f94f69_1785457729170.jpg';
  const destPng = '/Users/smarter.poker/Documents/pepnationlab/scratch/test-epithalon-7.png';
  
  // Convert jpg to png using sips (macOS built-in)
  execSync(`sips -s format png "${sourceJpg}" --out "${destPng}"`);
  
  const buffer = fs.readFileSync(destPng);
  
  const destName = 'test-epithalon-7.png';
  const { data, error } = await supabase.storage
    .from('print-labels')
    .upload(destName, buffer, {
      contentType: 'image/png',
      upsert: true
    });
    
  if (error) {
    console.error('Upload error:', error);
    return;
  }
  console.log('Uploaded successfully to print-labels/test-epithalon-7.png');
  
  // Insert test product
  const { data: pData, error: pError } = await supabase.from('products').insert({
    slug: 'test-epithalon-7',
    name: 'Epithalon 10mg (Test Print 7)',
    category: 'Anti-Aging',
    unit_size: 10,
    unit_measure: 'mg',
    is_active: true
  }).select();
  
  if (pError && pError.code !== '23505') {
    console.error('Insert error:', pError);
  } else {
    console.log('Inserted product test-epithalon-7');
  }
}
run();
