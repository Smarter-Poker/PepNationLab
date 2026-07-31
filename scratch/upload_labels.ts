import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function uploadLabels() {
  const file1Path = '/Users/smarter.poker/.gemini/antigravity/brain/fb49f354-f19d-4464-b091-a63cea11d8a7/.user_uploaded/media__1785540103493.png';
  const file2Path = '/Users/smarter.poker/.gemini/antigravity/brain/fb49f354-f19d-4464-b091-a63cea11d8a7/.user_uploaded/media__1785540105480.png';
  
  const files = [
    { source: file1Path, dest: 'savage/test-epithalon-3.png' },
    { source: file2Path, dest: 'savage/test-epithalon-4.png' }
  ];

  for (const f of files) {
    if (!fs.existsSync(f.source)) {
      console.error(`File not found: ${f.source}`);
      continue;
    }
    
    const buffer = fs.readFileSync(f.source);
    
    const { data, error } = await supabase.storage
      .from('print-labels')
      .upload(f.dest, buffer, {
        contentType: 'image/png',
        upsert: true
      });
      
    if (error) {
      console.error(`Failed to upload ${f.dest}:`, error);
    } else {
      console.log(`Successfully uploaded ${f.dest}:`, data);
    }
  }
}

uploadLabels();
