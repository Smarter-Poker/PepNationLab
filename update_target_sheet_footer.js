const fs = require('fs');
let markdown = fs.readFileSync('/Users/smarter.poker/.gemini/antigravity/brain/36b8d1d7-0e6d-4948-90a7-33f2114fbcf5/target_pricing_sheet.md', 'utf8');

markdown += `\n\n### Volume Discount Request\n`;
markdown += `> **Note to Supplier:** In addition to aligning the specific SKUs above with standard fair market rates, we are requesting a flat **10% Volume Discount** applied to the final invoice total in consideration of our ongoing $15,000+ purchasing blocks.\n`;

fs.writeFileSync('/Users/smarter.poker/.gemini/antigravity/brain/36b8d1d7-0e6d-4948-90a7-33f2114fbcf5/target_pricing_sheet.md', markdown);
console.log("Updated footer");
