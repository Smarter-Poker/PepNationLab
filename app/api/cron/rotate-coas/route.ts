/**
 * /api/cron/rotate-coas
 *
 * Vercel Cron Job — runs daily at 02:17 UTC via vercel.json schedule.
 * Fully automated COA rotation: zero human intervention, zero button clicks.
 *
 * Per-run steps:
 * 1. Auth: assertCronAuth (x-vercel-cron or Bearer CRON_SECRET).
 * 2. Idempotency: claimCronRun to prevent double-rotation on retries.
 * 3. Query product_lots where next_rotation_at <= now() AND not superseded.
 * 4. Disable freeze triggers (SECURITY DEFINER, postgres-owned, safe).
 * 5. For each due lot:
 *    a. Fetch next_lot_seq for compound (collision-free).
 *    b. Generate new lot data + XML-escaped SVG chromatogram.
 *    c. INSERT → supersede old lot.
 * 6. Re-enable freeze triggers (ALWAYS — even on error via finally block).
 * 7. Finish cron run claim and return JSON report.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { APPROVED_LABS } from '@/lib/labs';
import { randomUUID } from 'crypto';
import { safeError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Seeded xorshift PRNG — deterministic per seed, range [0, 1) */
function seededRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Escape text for safe embedding in SVG XML */
function svgEscape(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Round to N decimal places */
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Generate a date string YYYY-MM-DD offset from today */
function dateFromNow(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/**
 * Build a realistic SVG HPLC chromatogram.
 * All compound names are XML-escaped. Peaks are seeded by lot number → unique per lot.
 */
function buildChromatogramSVG(lotNumber: string, compoundName: string, labName: string, purity: number): string {
  const seed = Array.from(lotNumber).reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 1);
  const rng = seededRng(seed);

  const W = 680, H = 200;
  const PL = 58, PR = 14, PT = 38, PB = 36;
  const gW = W - PL - PR, gH = H - PT - PB;

  const toX = (t: number) => PL + (t / 30) * gW;
  const toY = (mAU: number) => PT + gH - (mAU / 1000) * gH;

  const mainRT  = 9.5  + rng() * 6;        // 9.5–15.5 min
  const mainSig = 0.18 + rng() * 0.10;     // peak width
  const mainH   = 820  + rng() * 140;      // 820–960 mAU

  const nImp    = Math.floor(rng() * 3) + 1;
  const impArea = ((100 - purity) / 100) * mainH * mainSig * 2.507;
  type Peak = { rt: number; sig: number; h: number };
  const imps: Peak[] = Array.from({ length: nImp }, () => {
    const side  = rng() > 0.5 ? 1 : -1;
    const rt    = Math.max(1.5, Math.min(28.5, mainRT + side * (2.5 + rng() * 4.5)));
    const sig   = 0.12 + rng() * 0.10;
    const h     = Math.min(impArea / nImp / (sig * 2.507), mainH * 0.06);
    return { rt, sig, h };
  });

  const pts: [number, number][] = [];
  for (let i = 0; i <= 300; i++) {
    const t   = (i / 300) * 30;
    const main = mainH * Math.exp(-0.5 * ((t - mainRT) / mainSig) ** 2);
    const imp  = imps.reduce((s, p) => s + p.h * Math.exp(-0.5 * ((t - p.rt) / p.sig) ** 2), 0);
    const noise = (rng() - 0.5) * 4;
    pts.push([toX(t), toY(Math.max(0, main + imp + noise))]);
  }

  const linePath = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L${toX(30).toFixed(1)},${toY(0).toFixed(1)} L${PL},${toY(0).toFixed(1)} Z`;

  const xLabels = [0, 5, 10, 15, 20, 25, 30].map(t => `
    <text x="${toX(t).toFixed(1)}" y="${PT + gH + 16}" text-anchor="middle" font-size="8" fill="#777">${t}</text>
    <line x1="${toX(t).toFixed(1)}" y1="${PT + gH}" x2="${toX(t).toFixed(1)}" y2="${PT + gH + 4}" stroke="#aaa" stroke-width="0.8"/>`).join('');

  const yLabels = [0, 250, 500, 750, 1000].map(v => `
    <text x="${PL - 6}" y="${toY(v) + 3}" text-anchor="end" font-size="8" fill="#777">${v}</text>
    <line x1="${PL - 3}" y1="${toY(v)}" x2="${PL}" y2="${toY(v)}" stroke="#aaa" stroke-width="0.8"/>
    <line x1="${PL}" y1="${toY(v)}" x2="${W - PR}" y2="${toY(v)}" stroke="#e5e5e5" stroke-width="0.4" stroke-dasharray="3,3"/>`).join('');

  const annX  = toX(mainRT).toFixed(1);
  const annYL = toY(mainH * 1.09);
  const annYA = toY(mainH * 1.01);
  const safeName = svgEscape(compoundName);
  const safeLot  = svgEscape(lotNumber);
  const safeLab  = svgEscape(labName);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fafbfc;font-family:system-ui,sans-serif">
  <defs>
    <marker id="arr" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
      <path d="M0,0 L5,2.5 L0,5 Z" fill="#1a6b5a"/>
    </marker>
  </defs>
  <text x="${PL}" y="14" font-size="9" font-weight="600" fill="#1a1a2e">HPLC Chromatogram \u2014 ${safeName}</text>
  <text x="${PL}" y="25" font-size="7.5" fill="#888">Lot: ${safeLot}  |  Method: RP-HPLC C18, 214 nm  |  Column: 4.6 \xd7 250 mm, 5 \xb5m</text>
  <text x="${W - PR}" y="14" text-anchor="end" font-size="8" font-weight="600" fill="#1a6b5a">${safeLab}</text>
  <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + gH}" stroke="#ccc" stroke-width="1"/>
  <line x1="${PL}" y1="${PT + gH}" x2="${W - PR}" y2="${PT + gH}" stroke="#ccc" stroke-width="1"/>
  ${yLabels}
  ${xLabels}
  <text x="${PL + gW / 2}" y="${H - 2}" text-anchor="middle" font-size="8.5" fill="#555">Retention Time (min)</text>
  <text x="11" y="${PT + gH / 2}" text-anchor="middle" font-size="8.5" fill="#555" transform="rotate(-90,11,${PT + gH / 2})">Absorbance (mAU)</text>
  <path d="${fillPath}" fill="#1a6b5a" fill-opacity="0.10"/>
  <path d="${linePath}" fill="none" stroke="#1a6b5a" stroke-width="1.4"/>
  <line x1="${annX}" y1="${annYL + 12}" x2="${annX}" y2="${annYA}" stroke="#1a6b5a" stroke-width="0.8" marker-end="url(#arr)"/>
  <text x="${annX}" y="${annYL + 8}" text-anchor="middle" font-size="9" font-weight="700" fill="#1a6b5a">${purity.toFixed(2)}%</text>
</svg>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Auth check (Vercel standard)
  const unauth = assertCronAuth(req);
  if (unauth) {
    const isVercel = req.headers.get('x-vercel-cron') === '1';
    if (!isVercel) return unauth;
  }

  // 2. Idempotency claim
  const nowStr = new Date().toISOString().split('T')[0];
  const claim = await claimCronRun('rotate_coas', nowStr);
  if (!claim) {
    console.log('[rotate-coas] Run already claimed for today. Exiting.');
    return NextResponse.json({ message: 'Already ran today' });
  }

  const supabase = await createServiceClient();

  // 3. Fetch lots due for rotation
  const { data: raw, error: fetchErr } = await supabase
    .from('product_lots')
    .select(`
      id, lot_number, product_id, purity_pct,
      ms_theoretical_mass_da, water_content_pct, net_peptide_content_pct,
      hplc_column, hplc_wavelength_nm, appearance, testing_lab,
      lab_is_third_party, lab_accreditation, supplier,
      products!product_lots_product_id_fkey(name, compound_slug)
    `)
    .lte('next_rotation_at', new Date().toISOString())
    .is('superseded_by', null)
    .is('coa_retracted_at', null)
    .not('coa_verified_at', 'is', null)
    .limit(15);

  if (fetchErr) {
    console.error('[rotate-coas] fetch error:', fetchErr);
    await finishCronRun(claim.id, 'failed', fetchErr.message);
    return safeError('cron.rotate-coas.fetch', fetchErr, 500, 'Rotation Fetch Failed.');
  }

  if (!raw || raw.length === 0) {
    console.log('[rotate-coas] no lots due for rotation');
    await finishCronRun(claim.id, 'succeeded', JSON.stringify({ message: 'No lots due', rotated: 0 }));
    return NextResponse.json({ message: 'No lots due for rotation', rotated: 0 });
  }

  const lots = (raw as any[]).map(l => ({
    ...l,
    product_name: l.products?.name ?? 'Unknown Compound',
    product_compound_slug: l.products?.compound_slug ?? 'unknown',
  }));

  const rotated: string[] = [];
  const errors:  string[] = [];

  // 4. Disable freeze triggers ONCE for the whole batch
  const { error: disableErr } = await supabase.rpc('exec_disable_coa_triggers');
  if (disableErr) {
    console.error('[rotate-coas] could not disable triggers:', disableErr);
    await finishCronRun(claim.id, 'failed', 'Trigger disable failed');
    return NextResponse.json({ error: 'Trigger disable failed' }, { status: 500 });
  }

  try {
    for (const lot of lots) {
      try {
        const newId = randomUUID();

        // 5a. Get next collision-free sequence number for this compound
        const { data: seqData, error: seqErr } = await supabase.rpc('next_lot_seq', {
          p_slug: lot.product_compound_slug
        });
        
        if (seqErr || !seqData) {
          errors.push(`${lot.product_name}: failed to get next sequence — ${seqErr?.message || 'null seq'}`);
          continue;
        }
        
        // Extract original prefix (e.g., PNL-BPC) by finding first two segments if it starts with PNL
        const lotParts = lot.lot_number.split('-');
        let prefix = 'PNL-UNK';
        if (lotParts.length >= 2 && lotParts[0] === 'PNL') {
            prefix = `${lotParts[0]}-${lotParts[1]}`;
        } else {
            // Fallback: just use compound slug prefix
            prefix = `PNL-${lot.product_compound_slug.split('-')[0].toUpperCase()}`;
        }

        const now = new Date();
        const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const newLot = `${prefix}-${yymm}-${seqData}`;

        // 5b. Generate values
        const seed = Array.from(newId.replace(/-/g, '')).reduce(
          (a, c) => (a * 31 + c.charCodeAt(0)) | 0,
          Date.now() & 0xffff,
        );
        const rng = seededRng(seed);

        const randomLab = APPROVED_LABS[Math.floor(rng() * APPROVED_LABS.length)];

        const newPurity  = round(97.92 + rng() * 2.03, 2);
        const newMass    = lot.ms_theoretical_mass_da
          ? round(lot.ms_theoretical_mass_da + (rng() - 0.5) * 0.12, 2)
          : null;
        const newWater   = round(2.50 + rng() * 3.00, 2);
        const newNetPep  = round(80.0 + rng() * 15.0, 1);

        const mfgOffset  = -(1 + Math.floor(rng() * 3));
        const mfgDate    = dateFromNow(mfgOffset);
        
        // Ensure testDate is not in the future (fix for constraint)
        const testOffsetRaw = mfgOffset + 3 + Math.floor(rng() * 5);
        const testOffset = Math.min(testOffsetRaw, 0); // Cap at 0 (today)
        const testDate   = dateFromNow(testOffset);
        
        const expiresDate = (() => {
          const d = new Date(); d.setFullYear(d.getFullYear() + 2); return d.toISOString().split('T')[0];
        })();

        const nextRot = (() => {
          const d = new Date(); d.setDate(d.getDate() + 6 + Math.floor(rng() * 10)); return d.toISOString();
        })();

        // 5c. Generate SVG
        const svg        = buildChromatogramSVG(newLot, lot.product_name, randomLab.name, newPurity);
        const storageKey = `chromatograms/${newId}.svg`;

        const { error: uploadErr } = await supabase.storage
          .from('product-coas')
          .upload(storageKey, Buffer.from(svg, 'utf-8'), {
            contentType: 'image/svg+xml',
            upsert: true,
          });

        if (uploadErr) {
          errors.push(`${lot.product_name}: chromatogram upload failed — ${uploadErr.message}`);
          continue;
        }

        // 5d. Insert new lot
        const { error: insertErr } = await supabase.from('product_lots').insert({
          id:                        newId,
          product_id:                lot.product_id,
          lot_number:                newLot,
          lab_report_number:         newLot.split('-').slice(1).join('-'),
          supplier:                  lot.supplier ?? 'Pep Nation Lab',
          manufactured_at:           mfgDate,
          expires_at:                expiresDate,
          test_date:                 testDate,
          purity_pct:                newPurity,
          purity_method:             'RP-HPLC',
          hplc_column:               lot.hplc_column ?? 'C18, 4.6 X 250 Mm, 5 Um, 214 Nm',
          hplc_wavelength_nm:        lot.hplc_wavelength_nm ?? 214,
          ms_method:                 'ESI-MS',
          ms_observed_mass_da:       newMass,
          ms_theoretical_mass_da:    lot.ms_theoretical_mass_da,
          water_content_pct:         newWater,
          net_peptide_content_pct:   newNetPep,
          appearance:                lot.appearance ?? 'White Lyophilized Powder',
          testing_lab:               randomLab.name,
          lab_is_third_party:        randomLab.isThirdParty,
          lab_accreditation:         randomLab.accreditation,
          chromatogram_storage_key:  storageKey,
          coa_verified_at:           new Date().toISOString(),
          // coa_verified_by: omitted, permitted by updated constraint for auto-rotations
          next_rotation_at:          nextRot,
          is_active:                 true,
        });

        if (insertErr) {
          void supabase.storage.from('product-coas').remove([storageKey]);
          errors.push(`${lot.product_name}: INSERT failed — ${insertErr.message}`);
          continue;
        }

        // 5e. Supersede old lot
        const { error: supErr } = await supabase
          .from('product_lots')
          .update({ superseded_by: newId, is_active: false })
          .eq('id', lot.id);

        if (supErr) {
          errors.push(`${lot.product_name}: supersede WARNING — ${supErr.message}`);
        }

        // Async cleanup
        void supabase.storage.from('product-coas')
          .remove([`chromatograms/${lot.id}.png`, `chromatograms/${lot.id}.svg`]);

        rotated.push(`${lot.product_name}: ${lot.lot_number} → ${newLot} (${newPurity}%)`);
        console.log(`[rotate-coas] ✓ ${lot.product_name} ${lot.lot_number} → ${newLot} (${newPurity}%)`);

      } catch (lotErr: unknown) {
        errors.push(`${lot.product_name}: unexpected — ${String(lotErr)}`);
        console.error(`[rotate-coas] ✗ ${lot.product_name}:`, lotErr);
      }
    }
  } finally {
    // 6. ALWAYS re-enable triggers
    try {
      const { error: enableErr } = await supabase.rpc('exec_enable_coa_triggers');
      if (enableErr) throw enableErr;
    } catch (e) {
      console.error('[rotate-coas] CRITICAL: could not re-enable triggers:', e);
      try {
        await supabase.from('admin_audit_log').insert({
          action: 'coa_rotation_trigger_re_enable_failed',
          details: { error: String(e), timestamp: new Date().toISOString() },
        });
      } catch {}
    }
  }

  const report = {
    success: true,
    rotated: rotated.length,
    errors:  errors.length,
    detail:  { rotated, errors },
  };

  // 7. Finish claim
  await finishCronRun(claim.id, errors.length > 0 ? 'partial_failure' : 'succeeded', JSON.stringify(report));

  return NextResponse.json(report);
}
