#!/usr/bin/env node
/**
 * upload-label.js  <localFilePath> <supabaseSlug>
 *
 * Uploads a generated label image to the Supabase print-labels bucket.
 * Converts JPEG→PNG if needed using sips (macOS).
 *
 * Usage:
 *   node scratch/upload-label.js /path/to/image.jpg retatrutide-rt10
 */

const path  = require('path');
const fs    = require('fs');
const { execSync } = require('child_process');
const { createClient } = require('./node_modules/@supabase/supabase-js');

require('./node_modules/dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const [,, srcFile, slug] = process.argv;
if (!srcFile || !slug) {
  console.error('Usage: node scratch/upload-label.js <srcFile> <slug>');
  process.exit(1);
}

if (!fs.existsSync(srcFile)) {
  console.error(`File not found: ${srcFile}`);
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function upload() {
  // Convert to PNG using sips (built-in on macOS)
  const pngPath = srcFile.replace(/\.(jpe?g|jpg)$/i, '.png');
  if (srcFile !== pngPath && !srcFile.endsWith('.png')) {
    execSync(`sips -s format png "${srcFile}" --out "${pngPath}"`, { stdio: 'inherit' });
  }

  const finalPath = fs.existsSync(pngPath) ? pngPath : srcFile;
  const buffer    = fs.readFileSync(finalPath);
  const destName  = `${slug}.png`;

  console.log(`Uploading ${finalPath} → print-labels/${destName} …`);

  const { data, error } = await sb.storage
    .from('print-labels')
    .upload(destName, buffer, { contentType: 'image/png', upsert: true });

  if (error) {
    console.error('UPLOAD FAILED:', JSON.stringify(error));
    process.exit(1);
  }

  const { data: pub } = sb.storage.from('print-labels').getPublicUrl(destName);
  console.log(`✅  ${destName}  →  ${pub.publicUrl}`);
}

upload().catch(e => { console.error(e); process.exit(1); });
