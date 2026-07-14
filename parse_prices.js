const fs = require('fs');
const data = JSON.parse(fs.readFileSync('all_products.json', 'utf8'));

const keywords = ['snap', 'epitalon', 'ipamorelin', 'klow', 'retatrutide', 'mots', 'tesamorelin', 'cjc', 'wolverine', 'pt-141', 'melanotan', 'glow'];

const found = data.filter(p => keywords.some(k => p.name.toLowerCase().includes(k)));
console.log(found.map(f => `${f.name}: Cost $${f.base_cost}, Retail $${f.retail_price}`).join('\n'));
