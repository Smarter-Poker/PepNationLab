const fs = require('fs');
let file = fs.readFileSync('components/AgentResearcherCRMv2.tsx', 'utf8');
file = file.replace(/\{isSubAgent && \([\s\S]*?\}\)/, ''); 
fs.writeFileSync('components/AgentResearcherCRMv2.tsx', file);
