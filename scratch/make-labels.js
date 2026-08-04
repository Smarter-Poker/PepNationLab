/**
 * make-labels.js — Pep Nation vial label generator
 *
 * BASE TEMPLATE  : media_1785873066484.png  (845×473, user-approved)
 * OUTPUT SIZE    : 900×450  (exactly 2:1 — fills the preview container)
 *
 * HOW IT WORKS
 * ────────────
 * 1. Resize reference to 900×450 with fill (slight uniform stretch).
 * 2. Black-out the left-dose, right-dose, and name zones.
 * 3. Draw a CLEAN full-width top grey stripe  (overrides reference artifacts).
 * 4. Draw a CLEAN full-width bottom grey stripe + "FOR RESEARCH USE ONLY" text.
 * 5. Composite symmetric dose badges and the peptide name.
 *
 * ZONE MAP (900×450)
 * ──────────────────
 *  TOP_GREY_H = 14    top stripe: y 0–13
 *  LOGO_X1    = 260   left MG zone:  x 0–259   logo protected: x 260–640
 *  LOGO_X2    = 640   right MG zone: x 640–899
 *  LOGO_BOTTOM= 255   logo/MG row ends at y 255
 *  NAME_TOP   = 240   name blackout starts (10 px overlap kills artifact)
 *  FOOTER_Y   = 360   bottom stripe: y 360–449
 *
 * LOGO zone (x 260–640, y 14–255) is NEVER touched — the full globe
 * and orbital ring are preserved from the reference image.
 *
 * STRIPES are drawn as clean SVG rects, guaranteeing full-width
 * edge-to-edge coverage regardless of the reference image offset.
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sharp        = require(path.join(__dirname, '..', 'node_modules', 'sharp'));
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb           = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Approved reference template ───────────────────────────────────────────────
const BASE_IMG = '/Users/smarter.poker/.gemini/antigravity/brain/5bc31974-9736-4b51-bb09-665c8b67621e/.user_uploaded/media_1785873066484.png';

// ── Canvas ────────────────────────────────────────────────────────────────────
const W = 900;
const H = 450;

// ── Zone constants ────────────────────────────────────────────────────────────
const TOP_GREY_H  = 20;   // top stripe height (extra height ensures no badge bleed)
const FOOTER_Y    = 360;  // bottom stripe starts here
const LOGO_X1     = 278;  // left edge: covers 10MG stroke (ends ≈277) without clipping "N" in Nation (starts ≈280)
const LOGO_X2     = 640;  // right edge of protected logo zone (covers full ring)
const LOGO_BOTTOM = 255;  // logo/MG row ends at this y
const NAME_TOP    = 240;  // name blackout starts (overlaps LOGO_BOTTOM by 15px)

// Stripe colours (sampled from approved reference)
const TOP_STRIPE_COLOUR    = '#BABABF';
const BOTTOM_STRIPE_COLOUR = '#B1B1B1';
const FOOTER_TEXT_COLOUR   = '#0d0d30';  // dark navy, matching approved design

// ── Font sizing ───────────────────────────────────────────────────────────────

/**
 * Dose badge — both zones are LOGO_X1 px wide, giving guaranteed symmetry.
 * Impact italic: effective char width ≈ 0.56 × font-size.
 */
function doseFontSize(dose) {
  if (!dose) return 0;
  const zoneW   = LOGO_X1;                        // 260 px
  const zoneH   = LOGO_BOTTOM - TOP_GREY_H;       // 241 px
  const fsFromW = Math.round(zoneW * 0.80 / (dose.length * 0.56));
  const fsFromH = Math.round(zoneH * 0.48);        // height ceiling ≈ 115px
  return Math.min(fsFromW, fsFromH);
}

/**
 * Peptide name — Impact upright, constrained by zone height then width.
 */
function nameFontSize(name) {
  const zoneH   = FOOTER_Y - NAME_TOP;            // 120 px
  const fsFromH = Math.round(zoneH * 0.82);       // ≈ 98 px ceiling
  const fsFromW = Math.round(W * 0.90 / (name.length * 0.52));
  return Math.min(fsFromH, fsFromW);
}

// ── SVG generators ────────────────────────────────────────────────────────────

/** Black-out: left dose zone + right dose zone + name zone. */
function svgBlackout() {
  const ly = TOP_GREY_H;
  const lh = LOGO_BOTTOM - TOP_GREY_H;   // 241px
  return (
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    // left dose zone
    `<rect x="0" y="${ly}" width="${LOGO_X1}" height="${lh}" fill="#000"/>` +
    // right dose zone  (W − LOGO_X2 = 260 px — perfectly symmetric with left)
    `<rect x="${LOGO_X2}" y="${ly}" width="${W - LOGO_X2}" height="${lh}" fill="#000"/>` +
    // name zone (wide overlap with LOGO_BOTTOM to kill dashed artifact)
    `<rect x="0" y="${NAME_TOP}" width="${W}" height="${FOOTER_Y - NAME_TOP}" fill="#000"/>` +
    `</svg>`
  );
}

/** Clean full-width top grey stripe. Overrides any reference-image artifacts. */
function svgTopStripe() {
  return (
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="0" y="0" width="${W}" height="${TOP_GREY_H}" fill="${TOP_STRIPE_COLOUR}"/>` +
    `</svg>`
  );
}

/** Clean full-width bottom grey stripe + "FOR RESEARCH USE ONLY" text. */
function svgBottomStripe() {
  const fH    = H - FOOTER_Y;              // 90 px
  const fCy   = FOOTER_Y + Math.round(fH / 2);
  const label = 'FOR RESEARCH USE ONLY';
  const fs    = Math.min(
    Math.round(fH * 0.62),                                        // height cap ≈ 55px
    Math.round(W * 0.85 / (label.replace(/ /g,'').length * 0.60 + label.split(' ').length * 0.35))
  );
  return (
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="0" y="${FOOTER_Y}" width="${W}" height="${fH}" fill="${BOTTOM_STRIPE_COLOUR}"/>` +
    `<text x="${Math.round(W / 2)}" y="${fCy}" ` +
    `font-family="Impact,Arial Narrow,Arial,sans-serif" ` +
    `font-size="${fs}" font-weight="900" letter-spacing="2" ` +
    `dominant-baseline="middle" text-anchor="middle" ` +
    `fill="${FOOTER_TEXT_COLOUR}">${label}</text>` +
    `</svg>`
  );
}

/**
 * Dose badges — BOTH text nodes share IDENTICAL attributes.
 * lx = left zone centre = LOGO_X1 / 2
 * rx = right zone centre = LOGO_X2 + (W − LOGO_X2) / 2
 * They are mathematically mirrored → impossible to differ in size.
 */
function svgDose(dose) {
  if (!dose) return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"></svg>`;
  const fs   = doseFontSize(dose);
  const cy   = TOP_GREY_H + Math.round((LOGO_BOTTOM - TOP_GREY_H) / 2);
  const lx   = Math.round(LOGO_X1 / 2);
  const rx   = LOGO_X2 + Math.round((W - LOGO_X2) / 2);
  const attr =
    `font-family="Impact,Arial Narrow,Arial,sans-serif" ` +
    `font-size="${fs}" font-style="italic" font-weight="900" ` +
    `dominant-baseline="middle" text-anchor="middle" ` +
    `fill="#C8C8C8" stroke="#0d1b5e" stroke-width="7" paint-order="stroke fill"`;
  return (
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<text x="${lx}" y="${cy}" ${attr}>${dose}</text>` +
    `<text x="${rx}" y="${cy}" ${attr}>${dose}</text>` +
    `</svg>`
  );
}

/** Peptide name — all-caps, centered in name zone. */
function svgName(name) {
  const upper = name.toUpperCase();
  const fs    = nameFontSize(upper);
  const cy    = NAME_TOP + Math.round((FOOTER_Y - NAME_TOP) / 2);
  return (
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<text x="${Math.round(W / 2)}" y="${cy}" ` +
    `font-family="Impact,Arial Narrow,Arial,sans-serif" ` +
    `font-size="${fs}" font-weight="900" ` +
    `dominant-baseline="middle" text-anchor="middle" ` +
    `fill="#C8C8C8">${upper}</text>` +
    `</svg>`
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function makeLabel({ slug, name, dose }) {
  // Resize reference to exact 2:1 canvas (minor uniform stretch ≈ 6%)
  const base = await sharp(BASE_IMG)
    .resize(W, H, { fit: 'fill' })
    .toFormat('png')
    .toBuffer();

  const buf = await sharp(base)
    .composite([
      // 1. Black out old MG text + old peptide name
      { input: Buffer.from(svgBlackout()),      blend: 'over' },
      // 2. Clean full-width bottom stripe + footer text
      { input: Buffer.from(svgBottomStripe()), blend: 'over' },
      // 3. New dose badges (perfectly symmetric)
      { input: Buffer.from(svgDose(dose)),      blend: 'over' },
      // 4. New peptide name
      { input: Buffer.from(svgName(name)),      blend: 'over' },
      // 5. Top stripe LAST — overwrites any anti-aliased bleed from dose badges
      { input: Buffer.from(svgTopStripe()),     blend: 'over' },
    ])
    .png({ compressionLevel: 7 })
    .toBuffer();

  const { error } = await sb.storage
    .from('print-labels')
    .upload(`${slug}.png`, buf, { contentType: 'image/png', upsert: true });

  if (error) throw new Error(`Upload failed for ${slug}: ${error.message}`);
  console.log(`✅  ${slug}`);
  return buf;
}

// ── Product list ──────────────────────────────────────────────────────────────
const PRODUCTS = [
  { slug:'5-amino-1mq-50am',                          name:'5-Amino-1MQ',              dose:'50MG'   },
  { slug:'5-amino-1mq-5am',                           name:'5-Amino-1MQ',              dose:'5MG'    },
  { slug:'acetic-acid-0-6-aa10',                      name:'Acetic Acid 0.6%',         dose:'10ML'   },
  { slug:'ahk-cu-au100',                              name:'AHK-CU',                   dose:'100MG'  },
  { slug:'ahk-cu-au',                                 name:'AHK-CU',                   dose:'50MG'   },
  { slug:'aicar-ar50',                                name:'AICAR',                    dose:'50MG'   },
  { slug:'aod9604-5ad',                               name:'AOD9604',                  dose:'5MG'    },
  { slug:'aod9604-10ad',                              name:'AOD9604',                  dose:'10MG'   },
  { slug:'ara290-cibinetide-ra10',                    name:'ARA290 (Cibinetide)',       dose:'10MG'   },
  { slug:'b12-b12',                                   name:'B12',                      dose:'10MG'   },
  { slug:'bac-water-ba3',                             name:'BAC Water',                dose:'3ML'    },
  { slug:'bac-water-ba10',                            name:'BAC Water',                dose:'10ML'   },
  { slug:'bpc-157-bc10',                              name:'BPC-157',                  dose:'10MG'   },
  { slug:'bpc-157-bc5',                               name:'BPC-157',                  dose:'5MG'    },
  { slug:'bpc-157-research-grade',                    name:'BPC-157 Research Grade',   dose:'5MG'    },
  { slug:'cagrilintide-cgl5',                         name:'Cagrilintide',             dose:'5MG'    },
  { slug:'cagrilintide-cgl10',                        name:'Cagrilintide',             dose:'10MG'   },
  { slug:'cerebrolysin-cbl60',                        name:'Cerebrolysin',             dose:'60MG'   },
  { slug:'cjc-1295-with-dac-cd5',                     name:'CJC-1295 With DAC',        dose:'5MG'    },
  { slug:'cjc-1295-without-dac-cnd5',                 name:'CJC-1295 Without DAC',     dose:'5MG'    },
  { slug:'cjc-1295-without-dac-cnd10',                name:'CJC-1295 Without DAC',     dose:'10MG'   },
  { slug:'dsip-ds10',                                 name:'DSIP',                     dose:'10MG'   },
  { slug:'dsip-ds5',                                  name:'DSIP',                     dose:'5MG'    },
  { slug:'epithalon-et10',                            name:'Epithalon',                dose:'10MG'   },
  { slug:'epithalon-et50',                            name:'Epithalon',                dose:'50MG'   },
  { slug:'follistatin-fn1',                           name:'Follistatin',              dose:'1MG'    },
  { slug:'foxo4-dri-f410',                            name:'FOXO4-DRI',                dose:'10MG'   },
  { slug:'cjc-1295-without-dac-5mg-ipa-5mg-cp10',    name:'GH Synergy Stack',         dose:'10MG'   },
  { slug:'ghk-cu-cu',                                 name:'GHK-CU',                   dose:'50MG'   },
  { slug:'ghk-cu-cu100',                              name:'GHK-CU',                   dose:'100MG'  },
  { slug:'ghrp-2-acetate-g25',                        name:'GHRP-2 Acetate',           dose:'5MG'    },
  { slug:'ghrp-2-acetate-g210',                       name:'GHRP-2 Acetate',           dose:'10MG'   },
  { slug:'ghrp-6-acetate-g65',                        name:'GHRP-6 Acetate',           dose:'5MG'    },
  { slug:'ghrp-6-acetate-g610',                       name:'GHRP-6 Acetate',           dose:'10MG'   },
  { slug:'glow-tb10-bpc10-ghk50-bbg70',               name:'Glow Stack',               dose:'70MG'   },
  { slug:'glutathione-gtt',                           name:'Glutathione',              dose:'1500MG' },
  { slug:'hcg-g5k',                                   name:'HCG',                      dose:'5000IU' },
  { slug:'hcg-g10k',                                  name:'HCG',                      dose:'10000IU'},
  { slug:'hexarelin-acetate-hx5',                     name:'Hexarelin Acetate',        dose:'5MG'    },
  { slug:'hgh-fragment-176-191-fr5',                  name:'HGH Fragment 176-191',     dose:'5MG'    },
  { slug:'hmg-g75',                                   name:'HMG',                      dose:'75IU'   },
  { slug:'igf-1lr3-ig1',                              name:'IGF-1LR3',                 dose:'1MG'    },
  { slug:'igf-1lr3-ig01',                             name:'IGF-1LR3',                 dose:'0.1MG'  },
  { slug:'ipamorelin-ip5',                            name:'Ipamorelin',               dose:'5MG'    },
  { slug:'ipamorelin-ip10',                           name:'Ipamorelin',               dose:'10MG'   },
  { slug:'kisspeptin-10-ks5',                         name:'KissPeptin-10',            dose:'5MG'    },
  { slug:'kisspeptin-10-ks10',                        name:'KissPeptin-10',            dose:'10MG'   },
  { slug:'klow-tb10-bpc10-ghk50-kpv10-k80',           name:'KLOW Stack',               dose:'80MG'   },
  { slug:'kpv-kp10',                                  name:'KPV',                      dose:'10MG'   },
  { slug:'the-limitless-stack-semax-selank',           name:'Limitless Stack',          dose:''       },
  { slug:'ll37-375',                                  name:'LL37',                     dose:'5MG'    },
  { slug:'melatonin-mt10',                            name:'Melatonin',                dose:'10MG'   },
  { slug:'mots-c-ms40',                               name:'MOTS-C',                   dose:'40MG'   },
  { slug:'mots-c-ms10',                               name:'MOTS-C',                   dose:'10MG'   },
  { slug:'mt-1-mt1',                                  name:'MT-1',                     dose:'10MG'   },
  { slug:'nad-nj500',                                 name:'NAD+',                     dose:'500MG'  },
  { slug:'nad-nj100',                                 name:'NAD+',                     dose:'100MG'  },
  { slug:'nad-nj1000',                                name:'NAD+',                     dose:'1000MG' },
  { slug:'oxytocin-acetate-ot5',                      name:'Oxytocin Acetate',         dose:'5MG'    },
  { slug:'oxytocin-acetate-ot10',                     name:'Oxytocin Acetate',         dose:'10MG'   },
  { slug:'pinealon-pn10',                             name:'Pinealon',                 dose:'10MG'   },
  { slug:'pt-141-p41',                                name:'PT-141',                   dose:'10MG'   },
  { slug:'retatrutide-rt10',                          name:'Retatrutide',              dose:'10MG'   },
  { slug:'retatrutide-rt20',                          name:'Retatrutide',              dose:'20MG'   },
  { slug:'retatrutide-rt50',                          name:'Retatrutide',              dose:'50MG'   },
  { slug:'retatrutide-rt5',                           name:'Retatrutide',              dose:'5MG'    },
  { slug:'retatrutide-rt60',                          name:'Retatrutide',              dose:'60MG'   },
  { slug:'retatrutide-rt40',                          name:'Retatrutide',              dose:'40MG'   },
  { slug:'retatrutide-rt30',                          name:'Retatrutide',              dose:'30MG'   },
  { slug:'retatrutide-rt15',                          name:'Retatrutide',              dose:'15MG'   },
  { slug:'selank-sk10',                               name:'Selank',                   dose:'10MG'   },
  { slug:'selank-sk5',                                name:'Selank',                   dose:'5MG'    },
  { slug:'semaglutide-sm20',                          name:'Semaglutide',              dose:'20MG'   },
  { slug:'semaglutide-sm15',                          name:'Semaglutide',              dose:'15MG'   },
  { slug:'semaglutide-sm10',                          name:'Semaglutide',              dose:'10MG'   },
  { slug:'semaglutide-sm5',                           name:'Semaglutide',              dose:'5MG'    },
  { slug:'semaglutide-sm30',                          name:'Semaglutide',              dose:'30MG'   },
  { slug:'semax-xa10',                                name:'Semax',                    dose:'10MG'   },
  { slug:'semax-xa5',                                 name:'Semax',                    dose:'5MG'    },
  { slug:'sermorelin-acetate-smo10',                  name:'Sermorelin Acetate',       dose:'10MG'   },
  { slug:'sermorelin-acetate-smo5',                   name:'Sermorelin Acetate',       dose:'5MG'    },
  { slug:'the-shred-stack-tirzepatide-aod9604',       name:'Shred Stack',              dose:''       },
  { slug:'snap-8-np810',                              name:'SNAP-8',                   dose:'10MG'   },
  { slug:'ss-31-2s10',                                name:'SS-31',                    dose:'10MG'   },
  { slug:'ss-31-2s50',                                name:'SS-31',                    dose:'50MG'   },
  { slug:'survodutide-sur10',                         name:'Survodutide',              dose:'10MG'   },
  { slug:'tb500-thymosin-b4-acetate-bt10',            name:'TB500',                    dose:'10MG'   },
  { slug:'tb500-thymosin-b4-acetate-bt5',             name:'TB500',                    dose:'5MG'    },
  { slug:'tesamorelin-tsm10',                         name:'Tesamorelin',              dose:'10MG'   },
  { slug:'tesamorelin-tsm20',                         name:'Tesamorelin',             dose:'20MG'   },
  { slug:'tesamorelin-tsm5',                          name:'Tesamorelin',              dose:'5MG'    },
  { slug:'cagrilintide-5mg-semaglutide-5mg-cs10',     name:'Appetite Crusher Stack',   dose:'10MG'   },
  { slug:'l-carnitine-lc600',                         name:'L-Carnitine Blend',        dose:'600MG'  },
  { slug:'l-carnitine-blend-multi-ingredient-lc216',  name:'L-Carnitine Blend',        dose:'10ML'   },
  { slug:'lemon-bottle-le10',                         name:'Lipolysis Stack',          dose:'10ML'   },
  { slug:'lipo-c-lc10',                               name:'Skinny Shot (Lipo-C)',     dose:'10ML'   },
  { slug:'bpc-10mg-tb-10mg-bb20',                     name:'Wolverine Stack (BPC+TB)', dose:'20MG'  },
  { slug:'bpc-5mg-tb-5mg-bb10',                       name:'Wolverine Stack (BPC+TB)', dose:'10MG'  },
  { slug:'thymalin-ty10',                             name:'Thymalin',                 dose:'10MG'   },
  { slug:'thymosin-alpha-1-ta10',                     name:'Thymosin Alpha-1',         dose:'10MG'   },
  { slug:'thymosin-alpha-1-ta5',                      name:'Thymosin Alpha-1',         dose:'5MG'    },
  { slug:'tirzepatide-tr80',                          name:'Tirzepatide',              dose:'80MG'   },
  { slug:'tirzepatide-tr90',                          name:'Tirzepatide',              dose:'90MG'   },
  { slug:'tirzepatide-tr60',                          name:'Tirzepatide',              dose:'60MG'   },
  { slug:'tirzepatide-tr70',                          name:'Tirzepatide',              dose:'70MG'   },
  { slug:'tirzepatide-tr120',                         name:'Tirzepatide',              dose:'120MG'  },
  { slug:'tirzepatide-tr100',                         name:'Tirzepatide',              dose:'100MG'  },
  { slug:'tirzepatide-tr10',                          name:'Tirzepatide',              dose:'10MG'   },
  { slug:'tirzepatide-tr20',                          name:'Tirzepatide',              dose:'20MG'   },
  { slug:'tirzepatide-tr50',                          name:'Tirzepatide',              dose:'50MG'   },
  { slug:'tirzepatide-tr5',                           name:'Tirzepatide',              dose:'5MG'    },
  { slug:'tirzepatide-tr15',                          name:'Tirzepatide',              dose:'15MG'   },
  { slug:'tirzepatide-tr30',                          name:'Tirzepatide',              dose:'30MG'   },
  { slug:'tirzepatide-tr40',                          name:'Tirzepatide',              dose:'40MG'   },
  { slug:'vip-vp10',                                  name:'VIP',                      dose:'10MG'   },
];

// ── CLI ───────────────────────────────────────────────────────────────────────
async function main() {
  const target  = process.argv[2];
  const preview = process.argv[3] === '--preview';
  const list    = target ? PRODUCTS.filter(p => p.slug === target) : PRODUCTS;

  if (list.length === 0) { console.error('No match:', target); process.exit(1); }

  console.log(`Generating ${list.length} label(s) at ${W}×${H}…\n`);
  let ok = 0, fail = 0;
  for (const p of list) {
    try {
      const buf = await makeLabel(p);
      if (preview) {
        const out = `/tmp/pn_${p.slug}.png`;
        fs.writeFileSync(out, buf);
        console.log(`   → ${out}`);
      }
      ok++;
    } catch (e) {
      console.error(`❌  ${p.slug}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\nDone. ✅ ${ok}  ❌ ${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
