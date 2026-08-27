const fs = require('fs');
const file = 'app/api/merchant-feed/[agentSlug]/route.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '<g:brand>Pep Nation Lab</g:brand>',
  '<g:brand>Pep Nation Lab</g:brand>\n      <g:google_product_category>3320</g:google_product_category>\n      <g:identifier_exists>no</g:identifier_exists>'
);

fs.writeFileSync(file, code);
console.log('Patched merchant-feed');
