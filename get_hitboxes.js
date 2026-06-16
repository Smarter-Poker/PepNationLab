const fs = require('fs');
const html = fs.readFileSync('public/peptide-101.html', 'utf8');
const lines = html.split('\n');
lines.forEach((line, i) => {
  if (line.includes('checkM5')) console.log(`M5 line ${i+1}: ${line.trim()}`);
  if (line.includes('checkM6')) console.log(`M6 line ${i+1}: ${line.trim()}`);
});
