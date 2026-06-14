import fs from 'fs';
import path from 'path';
const files=[];
(function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.ts')||e.name.endsWith('.tsx'))files.push(p);}})('app/api');
(function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.ts'))files.push(p);}})('lib');
const out=[];
const reFrom=/\.from\(\s*["'\x60]([a-zA-Z0-9_]+)["'\x60]\s*\)\s*\.(insert|update|upsert)\(\s*\{/g;
for(const f of files){
  const src=fs.readFileSync(f,'utf8');let m;
  while((m=reFrom.exec(src))){
    const table=m[1], op=m[2];
    let i=m.index+m[0].length-1, depth=0, body='';
    for(;i<src.length;i++){const ch=src[i];if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0)break;}if(depth>=1)body+=ch;}
    let d2=0,cur='',parts=[];
    for(const ch of body){if('{[('.includes(ch))d2++;else if('}])'.includes(ch))d2--;if(ch===','&&d2===0){parts.push(cur);cur='';}else cur+=ch;}
    if(cur.trim())parts.push(cur);
    for(let p of parts){p=p.trim();if(!p||p.startsWith('...'))continue;let key=p.split(':')[0].trim().replace(/["'\x60]/g,'');if(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key))out.push({f,table,op,key});}
  }
}
fs.writeFileSync('/tmp/writepairs.json',JSON.stringify(out));
const tables=[...new Set(out.map(r=>r.table))].sort();
console.log('write pairs:',out.length,'| tables:',tables.length);
console.log(tables.join(','));
