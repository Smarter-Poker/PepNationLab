import fs from 'fs';
import path from 'path';
const files=[];
(function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.ts')||e.name.endsWith('.tsx'))files.push(p);}})('app/api');
(function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.ts'))files.push(p);}})('lib');
const db=JSON.parse(fs.readFileSync('/tmp/dbcols.json','utf8'));
const out=[];
const reFrom=/\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)\s*\.(insert|update|upsert)\(\s*\{/g;
for(const f of files){
  const src=fs.readFileSync(f,'utf8');
  let m;
  while((m=reFrom.exec(src))){
    const table=m[1], op=m[2];
    const cols=db[table]; if(cols===undefined||cols==='__VIEW__'||cols==='') continue;
    const set=new Set(cols.split(','));
    // extract object literal from the '{' after insert(
    let i=m.index+m[0].length-1; // at '{'
    let depth=0, body=''; 
    for(;i<src.length;i++){const ch=src[i];if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0){break;}}if(depth>=1)body+=ch;}
    // top-level keys: split by comma at depth0 ignoring nested
    let d2=0, cur='', parts=[];
    for(const ch of body){ if('{[('.includes(ch))d2++; else if('}])'.includes(ch))d2--; if(ch===','&&d2===0){parts.push(cur);cur='';} else cur+=ch; }
    if(cur.trim())parts.push(cur);
    for(let p of parts){
      p=p.trim(); if(!p||p.startsWith('...')) continue;
      // key is before ':' (object) -- but watch for ternaries/values; take identifier or 'string' at start
      let key=p.split(':')[0].trim().replace(/['"`]/g,'');
      if(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)){
        if(!set.has(key)) out.push(`${table}.${key} (${op})  <-  ${f}`);
      }
    }
  }
}
const uniq=[...new Set(out)].sort();
console.log('POTENTIAL BAD WRITE COLUMNS:',uniq.length);
console.log(uniq.join('\n'));
