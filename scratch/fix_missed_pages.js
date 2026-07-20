const fs = require('fs');

const updateFile = (file, hasNavbar) => {
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('import BackButton')) {
    content = content.replace(/(import .*;\n)(?!(import .*;\n))/, "$1import BackButton from '@/components/ui/BackButton';\n");
  }

  if (!hasNavbar && !content.includes('<Navbar')) {
    if (!content.includes('import Navbar')) {
      content = content.replace(/(import .*;\n)(?!(import .*;\n))/, "$1import Navbar from '@/components/Navbar';\n");
    }
    
    // insert Navbar inside the main container, or wrap with <>
    if (content.includes('return (\n    <div')) {
      content = content.replace(/return \(\s*<div/, "return (\n    <>\n      <Navbar />\n      <div");
      content = content.replace(/<\/div>\s*\);\s*}/, "</div>\n    </>\n  );\n}");
    }
  }

  // insert BackButton
  if (!content.includes('<BackButton')) {
    if (content.includes('<h1')) {
      content = content.replace(/(<h1[^>]*>)/, '<div style={{ marginBottom: "var(--space-4)" }}><BackButton label="Back" /></div>\n      $1');
    } else if (content.includes('<main')) {
      content = content.replace(/(<main[^>]*>)/, '$1\n        <div style={{ padding: "var(--space-5)" }}><BackButton label="Back To Dashboard" /></div>');
    } else if (content.includes('className="container"')) {
      content = content.replace(/(className="container"[^>]*>)/, '$1\n        <div style={{ marginBottom: "var(--space-4)" }}><BackButton label="Back" /></div>');
    }
  }

  fs.writeFileSync(file, content);
}

updateFile('app/dashboard/agent/sub-agents/promote/page.tsx', false);
updateFile('app/dashboard/agent/help/page.tsx', true);
updateFile('app/dashboard/agent/promos/page.tsx', true);

