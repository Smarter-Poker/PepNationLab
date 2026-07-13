import fs from 'fs';
const F = process.argv[2];
let s = fs.readFileSync(F, 'utf8');
const orig = s;
const log = [];

const impAnchor = "import { getCityFAQs } from '@/lib/cities/city-content';\n";
if (s.includes(impAnchor) && !s.includes('getResearchAnchors')) {
  s = s.replace(impAnchor, impAnchor + "import { getResearchAnchors } from '@/lib/cities/research-anchors';\n");
  log.push('import');
} else log.push(s.includes('getResearchAnchors') ? 'import-already' : 'MISS-import');

const jsonAnchor = "  const jsonLd = {";
const block = [
"  // Regional research institutions (universities, academic medical centers,",
"  // national labs) mapped for this metro. Emitted as schema.org `mentions`",
"  // entities on the WebPage node - honest entity/topical signal, not a claim",
"  // of affiliation. Empty array when the region is not mapped.",
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

const wpAnchor = "        dateModified: CITY_CONTENT_UPDATED.toISOString().slice(0, 10),\n      },";
const wpRepl = "        dateModified: CITY_CONTENT_UPDATED.toISOString().slice(0, 10),\n        ...(researchMentions.length > 0 ? { mentions: researchMentions } : {}),\n      },";
if (s.includes(wpAnchor) && !s.includes('mentions: researchMentions')) {
  s = s.replace(wpAnchor, wpRepl);
  log.push('webpage-mentions');
} else log.push(s.includes('mentions: researchMentions') ? 'wp-already' : 'MISS-wp');

if (s !== orig) fs.writeFileSync(F, s);
console.log(JSON.stringify({ log, bytesBefore: orig.length, bytesAfter: s.length }));
