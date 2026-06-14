import fs from 'fs';
import path from 'path';
const root='app/api';
const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name==='route.ts'||e.name==='route.tsx')files.push(p);}})(root);
// also include lib server helpers that query
(function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.ts'))files.push(p);}})('lib');
const results=[];
// match .from('TABLE') ... .select(`...`) or .select('...') possibly chained across lines
const reFrom=/\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)/g;
for(const f of files){
  const src=fs.readFileSync(f,'utf8');
  let m;
  while((m=reFrom.exec(src))){
    const table=m[1];
    // find the next .select(...) within 400 chars after this .from
    const after=src.slice(m.index, m.index+600);
    const sel=after.match(/\.select\(\s*([`'"])([\s\S]*?)\1/);
    if(!sel) continue;
    const selStr=sel[2];
    if(selStr.trim()==='*'||selStr.includes('${')) continue; // wildcard or interpolated -> skip
    // tokenize top-level by comma respecting parens
    const cols=[];let depth=0,cur='';
    for(const ch of selStr){ if(ch==='(')depth++; else if(ch===')')depth--; if(ch===','&&depth===0){cols.push(cur);cur='';} else cur+=ch; }
    if(cur.trim())cols.push(cur);
    for(let c of cols){
      c=c.trim();
      if(!c) continue;
      if(c.includes('(')) continue; // relational embed
      if(c==='*') continue;
      // strip alias: 'alias:col' -> col ; strip !hint ; strip ::cast
      let col=c.includes(':')? c.split(':').pop() : c;
      col=col.split('!')[0].split('::')[0].trim();
      // only plain identifiers
      if(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) cols.push; // noop
      if(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) results.push({f,table,col});
    }
  }
}
// dedup
const seen=new Set();const out=[];
for(const r of results){const k=r.table+'|'+r.col;if(!seen.has(k+'|'+r.f)){seen.add(k+'|'+r.f);out.push(r);}}
fs.writeFileSync('/tmp/selpairs.json',JSON.stringify(out));
const tables=[...new Set(out.map(r=>r.table))].sort();
console.log('files scanned:',files.length,'| distinct (table,col,file):',out.length,'| tables:',tables.length);
console.log('tables:',tables.join(', '));
