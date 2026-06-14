import fs from 'fs';
import path from 'path';
const files=[];
function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.ts')||e.name.endsWith('.tsx'))files.push(p);}}
walk('app/api'); walk('lib');
const re=new RegExp("\\.from\\(\\s*[\"'`]([a-zA-Z0-9_]+)[\"'`]\\s*\\)\\s*\\.(insert|update|upsert)\\(\\s*\\{","g");
const db=Object.assign(JSON.parse(fs.readFileSync('/tmp/dbcols.json','utf8')),JSON.parse(fs.readFileSync('/tmp/dbcols2.json','utf8')));
const bad=[]; const allpairs=[];
for(const f of files){
  const src=fs.readFileSync(f,'utf8'); re.lastIndex=0; let m;
  while((m=re.exec(src))){
    const table=m[1], op=m[2];
    let i=m.index+m[0].length-1, depth=0, body='';
    for(;i<src.length;i++){const ch=src[i];
      if(ch==='{'){depth++; if(depth===1) continue;}
      else if(ch==='}'){depth--; if(depth===0) break;}
      body+=ch;
    }
    let d2=0,cur='',parts=[];
    for(const ch of body){if('{[('.includes(ch))d2++;else if('}])'.includes(ch))d2--;if(ch===','&&d2===0){parts.push(cur);cur='';}else cur+=ch;}
    if(cur.trim())parts.push(cur);
    for(let p of parts){p=p.trim();if(!p||p.startsWith('...'))continue;let key=p.split(':')[0].trim().replace(/["'`]/g,'');
      if(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)){allpairs.push({table,key,op,f});
        const cols=db[table]; if(cols&&cols!=='__VIEW__'&&cols!==''){ if(!new Set(cols.split(',')).has(key)) bad.push(`${table}.${key} (${op})  <-  ${f}`);}
      }}
  }
}
fs.writeFileSync('/tmp/writepairs.json',JSON.stringify(allpairs));
const u=[...new Set(bad)].sort();
const tablesInMap=[...new Set(allpairs.map(p=>p.table).filter(t=>db[t]!==undefined))];
const tablesNotInMap=[...new Set(allpairs.map(p=>p.table).filter(t=>db[t]===undefined))].sort();
console.log('write pairs:',allpairs.length,'| BAD (tables in map):',u.length);
console.log(u.join('\n'));
console.log('--- tables NOT in dbcols map (need separate check):',tablesNotInMap.length);
console.log(tablesNotInMap.join(','));
