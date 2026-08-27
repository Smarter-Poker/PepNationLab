const fs = require('fs');
const file = 'app/[agentSlug]/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "brand: { '@type': 'Brand', name: 'Pep Nation Lab' },",
  "brand: { '@type': 'Brand', name: 'Pep Nation Lab' },\n        sku: String(pp.product_id),"
);

fs.writeFileSync(file, code);
console.log('Patched page.tsx');
