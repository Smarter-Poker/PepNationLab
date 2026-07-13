import fs from 'fs';
const F = process.argv[2];
let s = fs.readFileSync(F, 'utf8');
const orig = s;
const log = [];

// 1) give BreadcrumbList an @id (first occurrence in this file)
const bcAnchor = "        '@type': 'BreadcrumbList',\n        itemListElement: [";
const bcRepl = "        '@type': 'BreadcrumbList',\n        '@id': `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}#breadcrumb`,\n        itemListElement: [";
if (s.includes(bcAnchor) && !s.includes('#breadcrumb')) {
  s = s.replace(bcAnchor, bcRepl);
  log.push('breadcrumb-id');
} else log.push(s.includes('#breadcrumb') ? 'bc-already' : 'MISS-bc');

// 2) connect the WebPage node: inLanguage + breadcrumb + mainEntity, inserted
//    right after its url line so ordering stays readable.
const wpAnchor = "        name: `Peptide Research In ${city.name}, ${city.stateAbbr}`,\n        isPartOf: { '@id': 'https://pepnationlab.com/#website' },";
const wpRepl = "        name: `Peptide Research In ${city.name}, ${city.stateAbbr}`,\n        inLanguage: 'en-US',\n        isPartOf: { '@id': 'https://pepnationlab.com/#website' },\n        breadcrumb: { '@id': `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}#breadcrumb` },\n        mainEntity: { '@id': `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}#service` },";
if (s.includes(wpAnchor) && !s.includes("inLanguage: 'en-US'")) {
  s = s.replace(wpAnchor, wpRepl);
  log.push('webpage-connect');
} else log.push(s.includes("inLanguage: 'en-US'") ? 'wp-already' : 'MISS-wp');

if (s !== orig) fs.writeFileSync(F, s);
console.log(JSON.stringify({ log, bytesBefore: orig.length, bytesAfter: s.length }));
