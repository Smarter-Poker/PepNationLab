// One-shot: upload the corrected Savage Shredder bundle art and point the
// bundle config at it. Run from the repo root:  npx tsx scratch/upload_shredder_v2.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AGENT_ID = '844dca4b-6f01-4779-bc95-bfa1e0809c0c'; // Savage Brands
const IMAGE_PATH = 'scratch/savage-shredder-v2.jpg';      // committed alongside this script

async function main() {
  if (!fs.existsSync(IMAGE_PATH)) { console.error('Image not found:', IMAGE_PATH); return; }
  const buffer = fs.readFileSync(IMAGE_PATH);
  const destName = `bundle-images/${AGENT_ID}-shredder-${Date.now()}.jpg`;

  const { error: upErr } = await supabase.storage
    .from('storefront-assets')
    .upload(destName, buffer, { contentType: 'image/jpeg', upsert: true });
  if (upErr) { console.error('Upload failed:', upErr); return; }

  const newUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/storefront-assets/${destName}`;
  console.log('Uploaded:', newUrl);

  const { data: prof, error: fErr } = await supabase
    .from('agent_profiles').select('bundles_config').eq('id', AGENT_ID).single();
  if (fErr) { console.error('Fetch failed:', fErr); return; }

  const bundles = prof.bundles_config || [];
  const b = bundles.find((x: { name?: string }) => x.name === 'Savage Shredder');
  if (!b) { console.error('Savage Shredder bundle not found.'); return; }
  b.image_url = newUrl;
  b.vial_image_url = newUrl;

  const { error: uErr } = await supabase
    .from('agent_profiles').update({ bundles_config: bundles }).eq('id', AGENT_ID);
  console.log(uErr ? `Update failed: ${uErr.message}` : 'DONE — Savage Shredder art is live. Hard-refresh the store.');
}

main();
