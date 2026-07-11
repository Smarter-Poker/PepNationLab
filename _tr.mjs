import ts from '/sessions/hopeful-determined-planck/mnt/pepnationlab/node_modules/typescript/lib/typescript.js';
import fs from 'fs';
const files = process.argv.slice(2);
let bad=0;
for (const f of files) {
  const src = fs.readFileSync(f,'utf8');
  const isTsx = f.endsWith('.tsx');
  const out = ts.transpileModule(src, {
    reportDiagnostics: true,
    fileName: f,
    compilerOptions: { jsx: isTsx?ts.JsxEmit.Preserve:undefined, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  });
  const errs = (out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if (errs.length){ bad++; console.log('SYNTAX ERRORS in',f); for(const d of errs){const m=ts.flattenDiagnosticMessageText(d.messageText,'\n');console.log('  ',m);} }
}
console.log(bad? `\n${bad} file(s) with syntax errors` : 'All files transpile cleanly (no syntax/parse errors)');
