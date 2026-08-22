import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SAVAGE_DIR = path.join(process.cwd(), 'public/images/savage-brands');
const allJpgs = new Set(fs.readdirSync(SAVAGE_DIR).filter(f => f.endsWith('.jpg') && !f.endsWith('.bak')));
function pngToJpg(pngPath: string, unitSize: number | null): string | null {
  if (!pngPath.includes('/images/savage-brands/')) return null;
  const pngFile = pngPath.split('/').pop()!.replace('.png', '');
  const stem = pngFile.toLowerCase();
  const dose = unitSize ? String(Math.round(unitSize)) : null;
  function tryJpg(filename: string): string | null {
    if (allJpgs.has(filename)) return '/images/savage-brands/' + filename;
    return null;
  }
  // Tirzepatide
  if (stem.startsWith('tirzepatide')) {
    return tryJpg(dose ? `tirzepatide-${dose}mg.jpg` : 'tirzepatide-10mg.jpg') || tryJpg('tirzepatide-10mg.jpg');
  }
  // Semaglutide
  if (stem.startsWith('semaglutide')) {
    return tryJpg(dose ? `semaglutide-${dose}mg.jpg` : 'semaglutide-10mg.jpg') || tryJpg('semaglutide-10mg.jpg');
  }
  // Retatrutide
  if (stem.startsWith('retatrutide')) {
    return tryJpg(dose ? `retatrutide-${dose}mg.jpg` : 'retatrutide-10mg.jpg') || tryJpg('retatrutide-10mg.jpg');
  }
  // Cagrilintide
  if (stem.startsWith('cagrilintide-5mg-semaglutide')) return tryJpg('stack-appetite-crusher-2vial.jpg');
  if (stem.startsWith('cagrilintide')) {
    return tryJpg(dose ? `cagrilintide-${dose}mg.jpg` : 'cagrilintide-10mg.jpg') || tryJpg('cagrilintide-10mg.jpg');
  }
  // AOD
  if (stem.startsWith('aod9604')) return tryJpg(dose ? `aod9604-${dose}mg.jpg` : 'aod9604-10mg.jpg') || tryJpg('aod9604-10mg.jpg');
  // Survodutide
  if (stem.startsWith('survodutide')) return tryJpg(dose ? `survodutide-${dose}mg.jpg` : 'survodutide-10mg.jpg') || tryJpg('survodutide-10mg.jpg');
  // Tesamorelin
  if (stem.startsWith('tesamorelin')) return tryJpg(dose ? `tesamorelin-${dose}mg.jpg` : 'tesamorelin-10mg.jpg') || tryJpg('tesamorelin-10mg.jpg');
  // 5-Amino-1MQ
  if (stem.startsWith('5-amino-1mq')) return tryJpg(dose ? `5-amino-1mq-${dose}mg.jpg` : '5-amino-1mq-5mg.jpg') || tryJpg('5-amino-1mq-5mg.jpg');
  // BPC stacks
  if (stem.startsWith('bpc-10mg-tb-10mg') || stem.startsWith('bpc-5mg-tb-5mg')) return tryJpg('stack-ultimate-recovery.jpg');
  // BPC-157
  if (stem.startsWith('bpc-157-research')) return tryJpg('bpc-157-research-5mg.jpg');
  if (stem.startsWith('bpc-157')) return tryJpg(dose ? `bpc-157-${dose}mg.jpg` : 'bpc-157-10mg.jpg') || tryJpg('bpc-157-10mg.jpg');
  // TB500
  if (stem.startsWith('tb500')) return tryJpg(dose ? `tb-500-${dose}mg.jpg` : 'tb-500-10mg.jpg') || tryJpg('tb-500-10mg.jpg');
  // KPV
  if (stem.startsWith('kpv')) return tryJpg('kpv-10mg.jpg');
  // KLOW stack
  if (stem.includes('klow')) return tryJpg('klow-stack-80mg.jpg');
  // GLOW stack
  if (stem.includes('glow-tb10')) return tryJpg('stack-glow-1vial.jpg');
  // GHK-CU
  if (stem.startsWith('ghk-cu')) return tryJpg(dose ? `ghkcu-${dose}mg.jpg` : 'ghkcu-50mg.jpg') || tryJpg('ghkcu-50mg.jpg');
  // AHK-CU
  if (stem.startsWith('ahk-cu')) return tryJpg(dose ? `ahkcu-${dose}mg.jpg` : 'ahkcu-50mg.jpg') || tryJpg('ahkcu-50mg.jpg');
  // SNAP-8
  if (stem.startsWith('snap-8')) return tryJpg('snap-8-10mg.jpg');
  // LL37
  if (stem.startsWith('ll37')) return tryJpg('ll-37-5mg.jpg');
  // CJC without DAC + IPA (stack)
  if (stem.startsWith('cjc-1295-without-dac-5mg-ipa')) return tryJpg('stack-gh-synergy-1vial.jpg');
  // CJC without DAC
  if (stem.startsWith('cjc-1295-without-dac')) return tryJpg(dose ? `cjc1295-without-dac-${dose}mg.jpg` : 'cjc1295-without-dac-10mg.jpg') || tryJpg('cjc1295-without-dac-10mg.jpg');
  // CJC with DAC
  if (stem.startsWith('cjc-1295-with-dac')) return tryJpg(dose ? `cjc1295-with-dac-${dose}mg.jpg` : 'cjc1295-with-dac-5mg.jpg') || tryJpg('cjc1295-with-dac-5mg.jpg');
  // Ipamorelin
  if (stem.startsWith('ipamorelin')) return tryJpg(dose ? `ipamorelin-${dose}mg.jpg` : 'ipamorelin-10mg.jpg') || tryJpg('ipamorelin-10mg.jpg');
  // GHRP-2
  if (stem.startsWith('ghrp-2')) return tryJpg(dose ? `ghrp2-${dose}mg.jpg` : 'ghrp2-10mg.jpg') || tryJpg('ghrp2-10mg.jpg');
  // GHRP-6
  if (stem.startsWith('ghrp-6')) return tryJpg(dose ? `ghrp6-${dose}mg.jpg` : 'ghrp6-10mg.jpg') || tryJpg('ghrp6-10mg.jpg');
  // Hexarelin
  if (stem.startsWith('hexarelin')) return tryJpg('hexarelin-5mg.jpg');
  // Sermorelin
  if (stem.startsWith('sermorelin')) return tryJpg(dose ? `sermorelin-${dose}mg.jpg` : 'sermorelin-10mg.jpg') || tryJpg('sermorelin-10mg.jpg');
  // HGH Fragment
  if (stem.startsWith('hgh-fragment')) return tryJpg('hgh-fragment-5mg.jpg');
  // IGF-1 LR3
  if (stem.startsWith('igf-1lr3') || stem.startsWith('igf1-lr3')) return tryJpg(stem.includes('01') ? 'igf1-lr3-01mg.jpg' : 'igf1-lr3-1mg.jpg') || tryJpg('igf1-lr3-1mg.jpg');
  // Follistatin
  if (stem.startsWith('follistatin')) return tryJpg('follistatin-1mg.jpg');
  // HMG
  if (stem.startsWith('hmg')) return tryJpg('hmg-75iu.jpg');
  // MOTS-C
  if (stem.startsWith('mots-c')) return tryJpg(dose ? `motsc-${dose}mg.jpg` : 'motsc-10mg.jpg') || tryJpg('motsc-10mg.jpg');
  // NAD
  if (stem.startsWith('nad')) return tryJpg(dose ? `nad-${dose}mg.jpg` : 'nad-100mg.jpg') || tryJpg('nad-100mg.jpg');
  // Epithalon
  if (stem.startsWith('epithalon') || stem.startsWith('test-epithalon')) return tryJpg(dose ? `epithalon-${dose}mg.jpg` : 'epithalon-10mg.jpg') || tryJpg('epithalon-10mg.jpg');
  // DSIP
  if (stem.startsWith('dsip')) return tryJpg(dose ? `dsip-${dose}mg.jpg` : 'dsip-10mg.jpg') || tryJpg('dsip-10mg.jpg');
  // FOXO4-DRI
  if (stem.startsWith('foxo4')) return tryJpg('foxo4dri-10mg.jpg');
  // Thymalin
  if (stem.startsWith('thymalin')) return tryJpg('thymalin-10mg.jpg');
  // Pinealon
  if (stem.startsWith('pinealon')) return tryJpg('pinealon-10mg.jpg');
  // Cerebrolysin
  if (stem.startsWith('cerebrolysin')) return tryJpg('cerebrolysin-60mg.jpg');
  // Thymosin Alpha-1
  if (stem.startsWith('thymosin-alpha')) return tryJpg(dose ? `thymosin-alpha-1-${dose}mg.jpg` : 'thymosin-alpha-1-10mg.jpg') || tryJpg('thymosin-alpha-1-10mg.jpg');
  // Kisspeptin
  if (stem.startsWith('kisspeptin')) return tryJpg(dose ? `kisspeptin10-${dose}mg.jpg` : 'kisspeptin10-10mg.jpg') || tryJpg('kisspeptin10-10mg.jpg');
  // PT-141
  if (stem.startsWith('pt-141')) return tryJpg('pt141-10mg.jpg');
  // Oxytocin
  if (stem.startsWith('oxytocin')) return tryJpg(dose ? `oxytocin-${dose}mg.jpg` : 'oxytocin-10mg.jpg') || tryJpg('oxytocin-10mg.jpg');
  // HCG
  if (stem.startsWith('hcg')) return tryJpg('hcg-5000iu.jpg');
  // Semax
  if (stem.startsWith('semax')) return tryJpg(dose ? `semax-${dose}mg.jpg` : 'semax-10mg.jpg') || tryJpg('semax-10mg.jpg');
  // Selank
  if (stem.startsWith('selank')) return tryJpg(dose ? `selank-${dose}mg.jpg` : 'selank-5mg.jpg') || tryJpg('selank-5mg.jpg');
  // Limitless stack (semax+selank)
  if (stem.includes('limitless') || stem.includes('semax-selank')) return tryJpg('stack-limitless.jpg');
  // Shred stack
  if (stem.includes('shred') || stem.includes('tirzepatide-aod')) return tryJpg('stack-weight-loss.jpg');
  // Dihexa
  if (stem.startsWith('dihexa')) return tryJpg('dihexa-30mg.jpg');
  // VIP
  if (stem.startsWith('vip')) return tryJpg('vip-10mg.jpg');
  // SS-31
  if (stem.startsWith('ss-31')) return tryJpg(stem.includes('2s50') ? 'ss-31-10mg.jpg' : 'ss-31-10mg.jpg');
  // AICAR
  if (stem.startsWith('aicar')) return tryJpg('aicar-50mg.jpg');
  // ARA290
  if (stem.startsWith('ara290')) return tryJpg('ara290-10mg.jpg');
  // Melatonin
  if (stem.startsWith('melatonin')) return tryJpg('melatonin-10mg.jpg');
  // MT-1
  if (stem.startsWith('mt-1')) return tryJpg('mt-1-10mg.jpg');
  // B12
  if (stem.startsWith('b12')) return tryJpg('b12-10mg.jpg');
  // Glutathione
  if (stem.startsWith('glutathione')) return tryJpg('glutathione-1500mg.jpg');
  // Lipo-C / Skinny Shot
  if (stem.startsWith('lipo-c')) return tryJpg('skinny-shot-10ml.jpg');
  // Lemon Bottle
  if (stem.startsWith('lemon-bottle')) return tryJpg('lipolysis-stack-10ml.jpg');
  // L-Carnitine / Furnace Stack
  if (stem.startsWith('l-carnitine')) return tryJpg('stack-furnace-1vial.jpg');
  // BAC Water
  if (stem.startsWith('bac-water')) return tryJpg('bac-water.jpg');
  // Acetic Acid
  if (stem.startsWith('acetic-acid')) return tryJpg('acetic-acid.jpg');
  return null;
}
async function run() {
  console.log('Fetching all agent_products with savage-brands PNG custom_image_url...');
  const { data: rows, error } = await sb
    .from('agent_products')
    .select('id, custom_image_url, product_id, products(name, unit_size)')
    .like('custom_image_url', '/images/savage-brands/%.png');
  if (error) { console.error('Fetch error:', error); return; }
  if (!rows?.length) { console.log('No PNG rows found — already fixed!'); return; }
  console.log(`Found ${rows.length} rows to fix\n`);
  let updated = 0, skipped = 0;
  const noMatch: string[] = [];
  for (const row of rows) {
    const prod = row.products as any;
    const unitSize = prod?.unit_size ? Number(prod.unit_size) : null;
    const jpgPath = pngToJpg(row.custom_image_url!, unitSize);
    if (!jpgPath) {
      noMatch.push(`  NO MATCH: ${prod?.name} (${unitSize}mg) | was: ${row.custom_image_url}`);
      skipped++;
      continue;
    }
    const { error: upErr } = await sb.from('agent_products').update({ custom_image_url: jpgPath }).eq('id', row.id);
    if (upErr) { console.error('  ERR:', row.id, upErr.message); skipped++; continue; }
    updated++;
    if (updated <= 20 || updated % 100 === 0) console.log(`  [${updated}] ${prod?.name} ${unitSize || ''}mg → ${jpgPath}`);
  }
  console.log(`\n✅ Updated ${updated} rows, skipped ${skipped}`);
  if (noMatch.length) { console.log('\nUnmatched:'); noMatch.forEach(m => console.log(m)); }
}
run();
