// Splices the expanded Florida and Texas city blocks into cities-data.ts.
// Aborts (exit 1) on any anchor mismatch so a failed run commits nothing.
const fs = require('fs');

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

// Remove the pre-existing stale duplicate O'Fallon Illinois entry (the second
// occurrence, which lacks zips and carries an outdated salesy blurb).
const ofallonMarker = "slug: 'ofallon'";
const of1 = s.indexOf(ofallonMarker);
if (of1 === -1) fail('ofallon marker missing');
const of2 = s.indexOf(ofallonMarker, of1 + 1);
if (of2 === -1) fail('expected two ofallon entries, found one');
if (s.indexOf(ofallonMarker, of2 + 1) !== -1) fail('expected exactly two ofallon entries');
const dupStart = s.lastIndexOf('  {\n', of2);
const dupClose = s.indexOf('  },\n', of2);
if (dupStart === -1 || dupClose === -1) fail('could not bound duplicate ofallon block');
const dupEnd = dupClose + '  },\n'.length;
const removed = s.slice(dupStart, dupEnd);
if (removed.length > 900) fail('duplicate ofallon block unexpectedly large');
if (!removed.includes('medianIncome: 90000,')) fail('duplicate ofallon block content mismatch');
if (removed.includes('zips')) fail('refusing to remove the canonical ofallon entry');
s = s.slice(0, dupStart) + s.slice(dupEnd);
console.log('Removed stale duplicate ofallon entry (' + removed.length + ' chars).');

const flHeader = '  // FLORIDA\n';
const txHeader = '  // TEXAS\n';
const ilHeader = '  // ILLINOIS - full state build-out';

const iFl = assertOnce(flHeader, 'florida header');
const iTx = assertOnce(txHeader, 'texas header');
const iIl = assertOnce(ilHeader, 'illinois header');
if (!(iFl < iTx && iTx < iIl)) fail('section order mismatch');

const dividerMatch = s.match(/^ {2}\/\/ ─+$/m);
if (!dividerMatch) fail('divider line not found');
const divider = dividerMatch[0];

const fl = fs.readFileSync('scripts/city-expansion/fl-block.txt', 'utf8').replace(/\s+$/, '');
const tx = fs.readFileSync('scripts/city-expansion/tx-block.txt', 'utf8').replace(/\s+$/, '');
if (fl.length < 30000) fail('florida block suspiciously small: ' + fl.length);
if (tx.length < 30000) fail('texas block suspiciously small: ' + tx.length);

const replacement =
  '  // FLORIDA - full state build-out, targeted by wealth + population.\n' +
  '  // County, ZIPs, and a unique localBlurb per city (doorway-page mitigation).\n' +
  divider + '\n' +
  fl + '\n\n' +
  divider + '\n' +
  '  // TEXAS - full state build-out, targeted by wealth + population.\n' +
  '  // County, ZIPs, and a unique localBlurb per city (doorway-page mitigation).\n' +
  divider + '\n' +
  tx + '\n\n' +
  divider + '\n';

s = s.slice(0, iFl) + replacement + s.slice(iIl);
fs.writeFileSync(TARGET, s);
console.log('Applied Florida and Texas expansion. New file length: ' + s.length);
