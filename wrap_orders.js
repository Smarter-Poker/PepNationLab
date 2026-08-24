const fs = require('fs');
let code = fs.readFileSync('components/AgentOrders.tsx', 'utf8');

code = code.replace(
  /return \(\s*<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var\(--space-4\)' }}>/,
  `return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>`
);

// We need to add the closing fragment tag at the very end of the return statement
code = code.replace(
  /(\s*)<\/div>\s*\);\s*}\s*$/,
  `$1</div>\n    </>\n  );\n}`
);

fs.writeFileSync('components/AgentOrders.tsx', code);
