#!/usr/bin/env node
/**
 * upload-vials-to-supabase.mjs
 * Uploads every PNG from public/images/products/ AND public/images/*.png
 * into Supabase Storage bucket "product-images".
 *
 * Usage: node scripts/upload-vials-to-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}
const BUCKET      = 'product-images';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Collect all images to upload ─────────────────────────────────────────────
const fileSets = [
  {
    dir: path.join(ROOT, 'public', 'images', 'products'),
    prefix: 'products',     // stored as products/filename.png
  },
  {
    dir: path.join(ROOT, 'public', 'images'),
    prefix: 'category',     // stored as category/vial_xxx.png
    filter: f => f.startsWith('vial_') || f.startsWith('peptide_'),
  },
];

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      fileSizeLimit: 10 * 1024 * 1024, // 10 MB
    });
    if (error) throw new Error(`Failed to create bucket: ${error.message}`);
    console.log(`✅ Created bucket: ${BUCKET}`);
  } else {
    console.log(`✅ Bucket already exists: ${BUCKET}`);
  }
}

async function uploadFile(localPath, storagePath) {
  const fileBuffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'image/png',
      upsert: true,   // overwrite if already exists
    });

  if (error) {
    console.error(`  ❌ ${storagePath} — ${error.message}`);
    return false;
  }
  return true;
}

async function main() {
  console.log('\n🚀 Pep Nation Lab — Supabase Storage Upload\n');

  await ensureBucket();

  let uploaded = 0;
  let failed = 0;
  let total = 0;

  for (const { dir, prefix, filter } of fileSets) {
    if (!fs.existsSync(dir)) {
      console.warn(`  ⚠️  Directory not found: ${dir}`);
      continue;
    }

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp'))
      .filter(f => filter ? filter(f) : true);

    console.log(`\n📁 ${dir} → ${files.length} files → bucket: ${BUCKET}/${prefix}/`);

    for (const file of files) {
      const localPath  = path.join(dir, file);
      const storagePath = `${prefix}/${file}`;
      total++;

      process.stdout.write(`  ↑ ${storagePath} ... `);
      const ok = await uploadFile(localPath, storagePath);
      if (ok) {
        console.log('✅');
        uploaded++;
      } else {
        failed++;
      }

      // Small delay to avoid rate-limiting
      await new Promise(r => setTimeout(r, 80));
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`✅ Uploaded : ${uploaded}/${total}`);
  if (failed > 0) console.log(`❌ Failed   : ${failed}`);
  console.log(`\n🌐 Public URL pattern:`);
  console.log(`   ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/products/<filename>.png`);
  console.log('════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
