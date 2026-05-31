const fs = require('fs');
let code = fs.readFileSync('components/AgentStoreProducts.tsx', 'utf8');

// Replace standard colors and classes
code = code.replace(/var\(--teal\)/g, '#00E5FF');
code = code.replace(/var\(--grey-400\)/g, 'rgba(255,255,255,0.4)');
code = code.replace(/var\(--white\)/g, '#fff');
code = code.replace(/var\(--surface-2\)/g, 'rgba(0,0,0,0.5)');
code = code.replace(/var\(--surface-3\)/g, 'rgba(255,255,255,0.05)');
code = code.replace(/className="btn btn-primary(.*?)"/g, 'className="btn-neon-cyan"');
code = code.replace(/className="btn btn-secondary(.*?)"/g, 'className="btn-silver"');

// Replace card-metal with metal-frame and metal-content
code = code.replace(/className="card-metal" style={{ padding: 'var\(--space-6\)' }}/g, 
  'className="metal-frame"><div className="metal-content" style={{ padding: "var(--space-6)" }}');

// Note: Because I replaced `<div className="card-metal"...>` with two divs, I need to add an extra closing div.
// Header is lines 248-294. 
// Bulk margin is lines 297-318.
// Flat view is lines 328-503.
// Category view is lines 513-683.
// It's easier to just do targeted regex or strings.

