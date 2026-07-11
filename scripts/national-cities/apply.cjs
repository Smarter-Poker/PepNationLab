// Splices the California expansion and the 14 new state blocks into
// lib/cities/cities-data.ts. Aborts (exit 1) on any anchor mismatch so a
// failed run commits nothing.
const fs = require('fs');
const path = require('path');

const TARGET = 'lib/cities/cities-data.ts';
let s = fs.readFileSync(TARGET, 'utf8');

function fail(msg) {
  console.error('ABORT: ' + msg);
  process.exit(1);
}

function assertOnce(needle, label) {
  const first = s.indexOf(needle);
  if (first === -1) fail('anchor missing: ' + label);
  if (s.indexOf(needle, first + 1) !== -1) fail('anchor not unique: ' + label);
  return first;
}

// Refuse to run twice.
if (s.includes("slug: 'los-altos-hills'")) fail('expansion already applied');
if (s.includes("stateSlug: 'wyoming'")) fail('wyoming already present');

// Remove the four pre-existing em and en dashes (platform style rule:
// no em dashes anywhere). Each replacement must match exactly once.
function replaceOnce(from, to, label) {
  const first = s.indexOf(from);
  if (first === -1) fail('dash cleanup target missing: ' + label);
  if (s.indexOf(from, first + 1) !== -1) fail('dash cleanup target not unique: ' + label);
  s = s.slice(0, first) + to + s.slice(first + from.length);
}
replaceOnce(
  'Home to the Lake Nona Medical City cluster — UCF College of Medicine, Nemours, and the VA hospital — a fast-rising research metro.',
  'Home to the Lake Nona Medical City cluster of UCF College of Medicine, Nemours, and the VA hospital, a fast-rising research metro.',
  'lake nona blurb'
);
replaceOnce(
  'Home to the University of Florida and UF Health Shands — one of the largest academic-medical and research centers in the Southeast.',
  'Home to the University of Florida and UF Health Shands, one of the largest academic-medical and research centers in the Southeast.',
  'gainesville blurb'
);
replaceOnce(
  'Home to the Texas Medical Center — the largest medical complex in the world — anchoring an enormous clinical-research economy.',
  'Home to the Texas Medical Center, the largest medical complex in the world, anchoring an enormous clinical-research economy.',
  'houston blurb'
);
replaceOnce(
  'A twin-city on the Texas–Arkansas border and regional medical center.',
  'A twin-city on the Texas-Arkansas border and regional medical center.',
  'texarkana blurb'
);
if (/[–—]/.test(s)) fail('em or en dash still present after cleanup');

const dividerMatch = s.match(/^ {2}\/\/ ─+$/m);
if (!dividerMatch) fail('divider line not found');
const divider = dividerMatch[0];

// 1) California expansion: insert new entries after the last existing CA
//    entry, immediately before the divider above the ARIZONA header.
const iCA = assertOnce('  // CALIFORNIA\n', 'california header');
const iAZ = assertOnce('  // ARIZONA\n', 'arizona header');
if (!(iCA < iAZ)) fail('section order mismatch');
const azDivStart = s.lastIndexOf(divider + '\n', iAZ);
if (azDivStart === -1 || azDivStart <= iCA) fail('arizona divider not found after california');

const ca = fs
  .readFileSync(path.join(__dirname, 'ca-block.txt'), 'utf8')
  .replace(/\s+$/, '');
if (ca.length < 15000) fail('california block suspiciously small: ' + ca.length);
if (!ca.startsWith('  // - CA Expansion')) fail('california block header mismatch');

s = s.slice(0, azDivStart) + ca + '\n\n' + s.slice(azDivStart);

// 2) New states: insert before the closing bracket of the CITIES array.
const iEnd = assertOnce('\n];\n', 'cities array close');

const st = fs
  .readFileSync(path.join(__dirname, 'states-block.txt'), 'utf8')
  .replace(/\s+$/, '');
if (st.length < 25000) fail('states block suspiciously small: ' + st.length);
if (!st.includes('// ALASKA')) fail('states block missing alaska');
if (!st.includes('// WYOMING')) fail('states block missing wyoming');

s = s.slice(0, iEnd) + '\n\n' + st + s.slice(iEnd);

fs.writeFileSync(TARGET, s);
console.log('Applied national city expansion. New file length: ' + s.length);
