const fs = require('fs');
let file = fs.readFileSync('components/AgentSales.tsx', 'utf8');
file = file.replace(/const showCommission = !!userProfile\?\.is_sub_agent;/g, 'const showCommission = false;');
file = file.replace(/\{showCommission && \([\s\S]*?\}\)/, ''); // Need to be careful here.
fs.writeFileSync('components/AgentSales.tsx', file);
