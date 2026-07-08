// Validates the expanded cities-data.ts. Exits 1 on any failure.
const { CITIES } = await import(new URL('../../lib/cities/cities-data.ts', import.meta.url).href);

let failed = false;
function fail(msg) {
  console.error('FAIL: ' + msg);
  failed = true;
}

const seen = new Set();
for (const c of CITIES) {
  const k = c.stateSlug + '/' + c.slug;
  if (seen.has(k)) fail('duplicate key ' + k);
  seen.add(k);
  if (!/^[a-z0-9-]+$/.test(c.slug)) fail('bad slug ' + c.slug);
}

const blurbs = new Set();
for (const c of CITIES) {
  if (c.localBlurb) {
    if (blurbs.has(c.localBlurb)) fail('duplicate blurb on ' + c.stateSlug + '/' + c.slug);
    blurbs.add(c.localBlurb);
  }
}

const tx = CITIES.filter((c) => c.stateSlug === 'texas');
const fl = CITIES.filter((c) => c.stateSlug === 'florida');
if (tx.length !== 100) fail('texas count expected 100, got ' + tx.length);
if (fl.length !== 108) fail('florida count expected 108, got ' + fl.length);

for (const c of [...tx, ...fl]) {
  if (!c.county) fail('missing county ' + c.slug);
  if (!c.zips || c.zips.length === 0) fail('missing zips ' + c.slug);
  else for (const z of c.zips) if (!/^\d{5}$/.test(z)) fail('bad zip ' + z + ' on ' + c.slug);
  if (!c.localBlurb) fail('missing blurb ' + c.slug);
  else if (/[—–]/.test(c.localBlurb)) fail('em or en dash in blurb ' + c.slug);
  if (!c.region) fail('missing region ' + c.slug);
  if (![1, 2, 3].includes(c.tier)) fail('bad tier ' + c.slug);
}

// Every previously live TX and FL page must still exist (no 404 regressions).
const requiredTx = ['plano','frisco','mckinney','allen','southlake','colleyville','keller','sugar-land','the-woodlands','katy','pearland','round-rock','cedar-park','leander','houston','dallas','austin','san-antonio','fort-worth','el-paso','arlington','corpus-christi','lubbock'];
const requiredFl = ['palm-beach','naples','boca-raton','coral-gables','aventura','weston','parkland','wellington','sarasota','fort-lauderdale','miami','tampa','orlando','jacksonville','st-petersburg','clearwater','delray-beach','pompano-beach','west-palm-beach','bonita-springs','marco-island'];
const txSlugs = new Set(tx.map((c) => c.slug));
const flSlugs = new Set(fl.map((c) => c.slug));
for (const slug of requiredTx) if (!txSlugs.has(slug)) fail('removed existing texas city ' + slug);
for (const slug of requiredFl) if (!flSlugs.has(slug)) fail('removed existing florida city ' + slug);

if (failed) process.exit(1);

const dist = { 1: 0, 2: 0, 3: 0 };
for (const c of [...tx, ...fl]) dist[c.tier]++;
console.log('OK total=' + CITIES.length + ' tx=' + tx.length + ' fl=' + fl.length + ' txfl tiers t1=' + dist[1] + ' t2=' + dist[2] + ' t3=' + dist[3]);
