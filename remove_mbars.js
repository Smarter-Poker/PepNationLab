const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./app', function(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Match borderTop: '1px solid rgba(...)' or "1px solid rgba(...)"
  let newContent = content
    .replace(/borderTop:\s*['"]1px solid rgba\([^)]+\)['"],?\s*/g, '')
    .replace(/borderBottom:\s*['"]1px solid rgba\([^)]+\)['"],?\s*/g, '')
    .replace(/borderTop:\s*['"]1px solid var\(--border-subtle\)['"],?\s*/g, '')
    .replace(/borderBottom:\s*['"]1px solid var\(--border-subtle\)['"],?\s*/g, '')
    .replace(/border-top:\s*1px solid rgba\([^)]+\);?/g, '')
    .replace(/border-bottom:\s*1px solid rgba\([^)]+\);?/g, '');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Updated', filePath);
  }
});
