import fs from 'fs';
const F = process.argv[2];
let s = fs.readFileSync(F, 'utf8');
const orig = s;
const log = [];

// 1) import getResearchAnchors after the City type import
const impAnchor = "import type { City } from './cities-data';\n";
if (s.includes(impAnchor) && !s.includes('research-anchors')) {
  s = s.replace(impAnchor, impAnchor + "import { getResearchAnchors } from './research-anchors';\n");
  log.push('import');
} else log.push(s.includes('research-anchors') ? 'import-already' : 'MISS-import');

// 2) add a "Regional Research Hubs" fact before the Median Household Income push
const block = [
"  const anchors = getResearchAnchors(city.region);",
"  if (anchors && anchors.length > 0) {",
"    facts.push({ label: 'Regional Research Hubs', value: anchors.slice(0, 4).map((a) => a.name).join(', ') });",
"  }",
"",
].join("\n");
const factAnchor = "  facts.push({ label: 'Median Household Income'";
if (s.includes(factAnchor) && !s.includes('Regional Research Hubs')) {
  s = s.replace(factAnchor, block + factAnchor);
  log.push('fact');
} else log.push(s.includes('Regional Research Hubs') ? 'fact-already' : 'MISS-fact');

if (s !== orig) fs.writeFileSync(F, s);
console.log(JSON.stringify({ log, bytesBefore: orig.length, bytesAfter: s.length }));
