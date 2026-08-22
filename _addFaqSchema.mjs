import fs from 'fs';
const F = process.argv[2];
let s = fs.readFileSync(F, 'utf8');
const orig = s;
const log = [];

// 1) import getCityFAQs after the CityPage import
const impAnchor = "import CityPage from './CityPage';\n";
if (s.includes(impAnchor) && !s.includes('getCityFAQs')) {
  s = s.replace(impAnchor, impAnchor + "import { getCityFAQs } from '@/lib/cities/city-content';\n");
  log.push('import');
} else log.push(s.includes('getCityFAQs') ? 'import-already' : 'MISS-import');

// 2) insert a FAQPage node before the @graph close
const node = [
"      {",
"        '@type': 'FAQPage',",
"        '@id': `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}#faq`,",
"        mainEntity: getCityFAQs(city).map((f) => ({",
"          '@type': 'Question',",
"          name: f.question,",
"          acceptedAnswer: { '@type': 'Answer', text: f.answer },",
"        })),",
"      },",
].join("\n");
const graphClose = "    ],\n  };\n\n  return (";
if (s.includes(graphClose) && !s.includes("'FAQPage'")) {
  s = s.replace(graphClose, node + "\n    ],\n  };\n\n  return (");
  log.push('faqpage');
} else log.push(s.includes("'FAQPage'") ? 'faqpage-already' : 'MISS-faqpage');

if (s !== orig) fs.writeFileSync(F, s);
console.log(JSON.stringify({ log, bytesBefore: orig.length, bytesAfter: s.length }));
