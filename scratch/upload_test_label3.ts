import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const uploads = [
    {
      file: '/Users/smarter.poker/.gemini/antigravity/brain/a19f9938-5124-4d98-ab0e-d8f465f94f69/.user_uploaded/media_1785790093714.png',
      bucketPaths: ['test-epithalon-pepnation.png']
    },
    {
      file: '/Users/smarter.poker/.gemini/antigravity/brain/a19f9938-5124-4d98-ab0e-d8f465f94f69/.user_uploaded/media_1785790100677.png',
      bucketPaths: ['test-epithalon-savage.png', 'savage/test-epithalon-savage.png']
    }
  ];

  for (const u of uploads) {
    const buffer = fs.readFileSync(u.file);
    for (const p of u.bucketPaths) {
      const { data, error } = await supabase.storage
        .from('print-labels')
        .upload(p, buffer, { contentType: 'image/png', upsert: true });
        
      if (error) console.error('Upload error:', p, error);
      else console.log('Uploaded:', p);
    }
  }
}
run();
