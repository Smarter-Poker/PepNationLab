const fs = require('fs');
let code = fs.readFileSync('components/AgentSales.tsx', 'utf8');

code = code.replace(
  /const absoluteLifetimeRevenue = sum\(absoluteCollected, 'total'\);/,
  `const _sum = (arr: any[], k: string) => arr.reduce((s, o) => s + (Number(o[k]) || 0), 0);
    const absoluteLifetimeRevenue = _sum(absoluteCollected, 'total');`
);

fs.writeFileSync('components/AgentSales.tsx', code);
