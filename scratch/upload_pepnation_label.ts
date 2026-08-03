import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function uploadLabel() {
  const sourceFile = '/Users/smarter.poker/.gemini/antigravity/brain/a19f9938-5124-4d98-ab0e-d8f465f94f69/.tempmediaStorage/media_a19f9938-5124-4d98-ab0e-d8f465f94f69_1785457729170.jpg';
  const destName = 'pepnation/epithalon-10mg-test-print.jpg';

  if (!fs.existsSync(sourceFile)) {
    console.error(`File not found: ${sourceFile}`);
    return;
  }
  
  const buffer = fs.readFileSync(sourceFile);
  
  const { data, error } = await supabase.storage
    .from('print-labels')
    .upload(destName, buffer, {
      contentType: 'image/jpeg',
      upsert: true
    });
    
  if (error) {
    console.error(`Failed to upload ${destName}:`, error);
  } else {
    console.log(`Successfully uploaded ${destName}:`, data);
    
    // Get public URL just in case
    const { data: pubData } = supabase.storage.from('print-labels').getPublicUrl(destName);
    console.log(`Public URL: ${pubData.publicUrl}`);
  }
}

uploadLabel();
