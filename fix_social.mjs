import fs from 'fs';
import path from 'path';

const files = [
  'components/research/CompareTool.tsx',
  'components/research/AreaReferencesClient.tsx',
  'components/research/CompoundReferencesClient.tsx',
  'components/research/MonographTabs.tsx',
  'components/research/ReferencesBrowser.tsx',
  'components/research/TrialsMetricsPanel.tsx',
  'components/ui/IframeLink.tsx'
];

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Add import if not present
  if (!content.includes('isSocialPlatformUrl')) {
    const importStatement = `import { isSocialPlatformUrl } from '@/lib/ArticleProxyUtils';\n`;
    // Find the last import
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfLine = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, endOfLine + 1) + importStatement + content.slice(endOfLine + 1);
      changed = true;
    }
  }

  while (true) {
    const matchStart = content.indexOf('setModalUrl(');
    if (matchStart === -1) break;

    // Find the matching parenthesis
    let depth = 0;
    let urlStart = matchStart + 'setModalUrl('.length - 1;
    let matchEnd = -1;
    for (let i = urlStart; i < content.length; i++) {
      if (content[i] === '(') depth++;
      else if (content[i] === ')') {
        depth--;
        if (depth === 0) {
          matchEnd = i;
          break;
        }
      }
    }

    if (matchEnd === -1) break; // Something is wrong

    const urlExpr = content.slice(urlStart + 1, matchEnd);

    // Skip if it's "null"
    if (urlExpr === 'null') {
      // Just temporarily rename it so we don't process it again
      content = content.slice(0, matchStart) + '___SETMODALURL_NULL___' + content.slice(matchEnd + 1);
      continue;
    }

    // Replace setModalUrl(...) with the conditional
    const replacement = `(isSocialPlatformUrl(${urlExpr}) ? window.open(${urlExpr}, '_blank') : ___TEMP_SETMODALURL___(${urlExpr}))`;
    content = content.slice(0, matchStart) + replacement + content.slice(matchEnd + 1);
    changed = true;
  }

  // Restore the temporary replacements
  content = content.replace(/___SETMODALURL_NULL___/g, 'setModalUrl(null)');
  content = content.replace(/___TEMP_SETMODALURL___/g, 'setModalUrl');

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
