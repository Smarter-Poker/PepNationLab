import fs from 'fs';
const F = process.argv[2];
let s = fs.readFileSync(F, 'utf8');
const orig = s;
const log = [];

// 1) BreadcrumbList @id
const bc = "        '@type': 'BreadcrumbList',\n        itemListElement: [";
const bcR = "        '@type': 'BreadcrumbList',\n        '@id': `${pageUrl}#breadcrumb`,\n        itemListElement: [";
if (s.includes(bc) && !s.includes('#breadcrumb')) { s = s.replace(bc, bcR); log.push('bc'); }
else log.push(s.includes('#breadcrumb') ? 'bc-already' : 'MISS-bc');

// 2) productNode @id (right after its '@type': 'Product',)
const pn = "        '@type': 'Product',\n        name: `${compound.displayName} - Research Grade`,";
const pnR = "        '@type': 'Product',\n        '@id': `${pageUrl}#product`,\n        name: `${compound.displayName} - Research Grade`,";
if (s.includes(pn) && !s.includes('#product')) { s = s.replace(pn, pnR); log.push('product-id'); }
else log.push(s.includes('#product') ? 'pn-already' : 'MISS-pn');

// 3) FAQPage @id
const fq = "        '@type': 'FAQPage',\n        mainEntity: faqs.map((f) => ({";
const fqR = "        '@type': 'FAQPage',\n        '@id': `${pageUrl}#faq`,\n        mainEntity: faqs.map((f) => ({";
if (s.includes(fq) && !s.includes('#faq')) { s = s.replace(fq, fqR); log.push('faq-id'); }
else log.push(s.includes('#faq') ? 'fq-already' : 'MISS-fq');

// 4) WebPage: inLanguage after name
const wpName = "        name: `${compound.displayName} In ${city.name}, ${city.stateAbbr}`,\n        isPartOf: { '@id': `${BASE}/#website` },";
const wpNameR = "        name: `${compound.displayName} In ${city.name}, ${city.stateAbbr}`,\n        inLanguage: 'en-US',\n        isPartOf: { '@id': `${BASE}/#website` },\n        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },\n        ...(productNode ? { mainEntity: { '@id': `${pageUrl}#product` } } : {}),";
if (s.includes(wpName) && !s.includes("inLanguage: 'en-US'")) { s = s.replace(wpName, wpNameR); log.push('webpage'); }
else log.push(s.includes("inLanguage: 'en-US'") ? 'wp-already' : 'MISS-wp');

if (s !== orig) fs.writeFileSync(F, s);
console.log(JSON.stringify({ log, bytesBefore: orig.length, bytesAfter: s.length }));
