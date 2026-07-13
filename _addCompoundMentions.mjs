import fs from 'fs';
const F = process.argv[2];
let s = fs.readFileSync(F, 'utf8');
const orig = s;
const log = [];

// 1) import getResearchAnchors after the city-content import line
const impAnchor = "import { getRegionLabel, getRegionArea } from '@/lib/cities/city-content';\n";
if (s.includes(impAnchor) && !s.includes('research-anchors')) {
  s = s.replace(impAnchor, impAnchor + "import { getResearchAnchors } from '@/lib/cities/research-anchors';\n");
  log.push('import');
} else log.push(s.includes('research-anchors') ? 'import-already' : 'MISS-import');

// 2) compute researchMentions before the jsonLd declaration
const jsonAnchor = "  const jsonLd = {";
const block = [
"  // Regional research institutions for this metro, emitted as schema.org",
"  // `mentions` on the WebPage node - honest entity/topical context for the",
"  // local research audience. Empty when the region is not mapped.",
"  const _anchors = getResearchAnchors(city.region);",
"  const researchMentions = _anchors",
"    ? _anchors.map((a) => ({",
"        '@type':",
"          a.kind === 'University'",
"            ? 'CollegeOrUniversity'",
"            : a.kind === 'Medical Center'",
"              ? 'MedicalOrganization'",
"              : a.kind === 'National Lab' || a.kind === 'Research Institute'",
"                ? 'ResearchOrganization'",
"                : 'Organization',",
"        name: a.name,",
"      }))",
"    : [];",
"",
].join("\n");
if (s.includes(jsonAnchor) && !s.includes('researchMentions')) {
  s = s.replace(jsonAnchor, block + jsonAnchor);
  log.push('mentions-const');
} else log.push(s.includes('researchMentions') ? 'const-already' : 'MISS-const');

// 3) add mentions spread into the WebPage node (after the about line)
const wpAnchor = "        about: { '@type': 'Thing', name: compound.displayName, sameAs: monographUrl },";
const wpRepl = wpAnchor + "\n        ...(researchMentions.length > 0 ? { mentions: researchMentions } : {}),";
if (s.includes(wpAnchor) && !s.includes('mentions: researchMentions')) {
  s = s.replace(wpAnchor, wpRepl);
  log.push('webpage-mentions');
} else log.push(s.includes('mentions: researchMentions') ? 'wp-already' : 'MISS-wp');

if (s !== orig) fs.writeFileSync(F, s);
console.log(JSON.stringify({ log, bytesBefore: orig.length, bytesAfter: s.length }));
