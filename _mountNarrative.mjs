import fs from 'fs';
const F = process.argv[2];
let s = fs.readFileSync(F, 'utf8');
const orig = s;
const log = {};

// 1) de-unicode decorative comment separators (ALL non-ASCII in this file is
//    box-drawing/dash chars inside comments - verified). Deterministic swap.
const before = (s.match(/[^\x00-\x7F]/g) || []).length;
s = s.replace(/═/g, '=').replace(/─/g, '-').replace(/—/g, '-');
const after = (s.match(/[^\x00-\x7F]/g) || []).length;
log.nonAsciiBefore = before; log.nonAsciiAfter = after;

// 2) import CityNarrative after the near-me import
const imp = "import { getNearMeCities } from '@/lib/cities/near-me';\n";
if (s.includes(imp) && !s.includes("import CityNarrative")) {
  s = s.replace(imp, imp + "import CityNarrative from './CityNarrative';\n");
  log.import = true;
} else log.import = s.includes('import CityNarrative') ? 'already' : 'MISS';

// 3) mount <CityNarrative> right after the NearbyStrip line
const mountAnchor = "        <NearbyStrip stateSlug={stateSlug} currentCitySlug={citySlug} stateName={city.state} region={city.region} />\n";
if (s.includes(mountAnchor) && !s.includes('<CityNarrative')) {
  s = s.replace(mountAnchor, mountAnchor + "\n        {/* TIER-1 DEEP NARRATIVE - long-form, per-city-unique body copy; renders\n            only on tier-1 markets (getCityNarrative returns null otherwise). */}\n        <CityNarrative city={city} />\n");
  log.mount = true;
} else log.mount = s.includes('<CityNarrative') ? 'already' : 'MISS';

if (s !== orig) fs.writeFileSync(F, s);
console.log(JSON.stringify(log));
