import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dir = './public/payment-logos';
const files = fs.readdirSync(dir);

for (const file of files) {
  if (!file.endsWith('.svg')) continue;
  const content = fs.readFileSync(path.join(dir, file));
  const { data, error } = await supabase.storage.from('public-assets').upload('payment-logos/' + file, content, { upsert: true, contentType: 'image/svg+xml' });
  if (error) console.error(file, error);
  else {
    const pubUrl = supabase.storage.from('public-assets').getPublicUrl('payment-logos/' + file).data.publicUrl;
    console.log(file, pubUrl);
  }
}
