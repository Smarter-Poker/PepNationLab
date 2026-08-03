import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const files = [
    {
      sourceJpg: '/Users/smarter.poker/.gemini/antigravity/brain/a19f9938-5124-4d98-ab0e-d8f465f94f69/.tempmediaStorage/media_a19f9938-5124-4d98-ab0e-d8f465f94f69_1785457729170.jpg',
      destPng: '/Users/smarter.poker/Documents/pepnationlab/scratch/test-epithalon-pepnation.png',
      bucketPath: 'test-epithalon-pepnation.png',
      slug: 'test-epithalon-pepnation',
      name: 'Epithalon 10mg (PepNation Test)',
      bucket: 'print-labels'
    },
    {
      sourceJpg: '/Users/smarter.poker/.gemini/antigravity/brain/a19f9938-5124-4d98-ab0e-d8f465f94f69/.tempmediaStorage/media_a19f9938-5124-4d98-ab0e-d8f465f94f69_1785457723685.jpg',
      destPng: '/Users/smarter.poker/Documents/pepnationlab/scratch/test-epithalon-savage.png',
      bucketPath: 'savage/test-epithalon-savage.png', // savage bucket path
      slug: 'test-epithalon-savage',
      name: 'Epithalon 10mg (Savage Brands Test)',
      bucket: 'print-labels'
    }
  ];

  for (const f of files) {
    try {
      execSync(`sips -s format png "${f.sourceJpg}" --out "${f.destPng}"`);
      const buffer = fs.readFileSync(f.destPng);
      
      const { data, error } = await supabase.storage
        .from(f.bucket)
        .upload(f.bucketPath, buffer, { contentType: 'image/png', upsert: true });
        
      if (error) console.error('Upload error for', f.slug, error);
      else console.log('Uploaded successfully:', f.bucketPath);
      
      const { data: pData, error: pError } = await supabase.from('products').insert({
        slug: f.slug,
        name: f.name,
        category: 'Anti-Aging',
        unit_size: 10,
        unit_measure: 'mg',
        is_active: true
      }).select();
      
      if (pError && pError.code !== '23505') console.error('Insert error:', pError);
      else console.log('Inserted product', f.slug);
      
    } catch (e) {
      console.error(e);
    }
  }
}
run();
