const fs = require('fs');
let code = fs.readFileSync('components/AgentSales.tsx', 'utf8');

// Replace `const absoluteCollected = absoluteAll.filter((o) => COLLECTED.has(o.status));`
code = code.replace(
  /const absoluteCollected = absoluteAll\.filter\(\(o\) => COLLECTED\.has\(o\.status\)\);/,
  `const absoluteCollected = absoluteAll;`
);

// Replace `const collected = all.filter((o) => COLLECTED.has(o.status));`
code = code.replace(
  /const collected = all\.filter\(\(o\) => COLLECTED\.has\(o\.status\)\);/,
  `const collected = all;`
);

fs.writeFileSync('components/AgentSales.tsx', code);
