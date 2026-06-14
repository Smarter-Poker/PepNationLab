import fs from 'fs';
import path from 'path';
const files=[];
function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.ts')||e.name.endsWith('.tsx'))files.push(p);}}
walk('app/api'); walk('lib');
const fromRe=new RegExp("\\.from\\(\\s*[\"'`]([a-zA-Z0-9_]+)[\"'`]\\s*\\)","g");
const filtRe=new RegExp("\\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|overlaps|order|match)\\(\\s*[\"'`]([a-zA-Z0-9_]+)[\"'`]","g");
const orRe=new RegExp("\\.or\\(\\s*[\"'`]([^\"'`]+)[\"'`]","g");
const out=[];
for(const f of files){
  const src=fs.readFileSync(f,'utf8');
  // find all .from positions
  const froms=[]; let m; fromRe.lastIndex=0;
  while((m=fromRe.exec(src))) froms.push({idx:m.index, table:m[1]});
  for(let i=0;i<froms.length;i++){
    const start=froms[i].idx;
    const end=i+1<froms.length?froms[i+1].idx:Math.min(src.length,start+1200);
    const win=src.slice(start,end);
    const table=froms[i].table;
    let mm; filtRe.lastIndex=0;
    while((mm=filtRe.exec(win))){ out.push({table,col:mm[2],f,op:mm[1]}); }
    orRe.lastIndex=0;
    while((mm=orRe.exec(win))){
      for(const clause of mm[1].split(',')){
        const col=clause.split('.')[0].trim();
        if(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) out.push({table,col,f,op:'or'});
      }
    }
  }
}
// dedup distinct table.col
const seen=new Set(); const pairs=[];
for(const o of out){const k=o.table+'.'+o.col; if(!seen.has(k)){seen.add(k); pairs.push(o);}}
fs.writeFileSync('/tmp/filt.json',JSON.stringify(out));
// emit distinct table|col for SQL
console.log('total filter refs:',out.length,'| distinct table.col:',pairs.length);
console.log(pairs.map(p=>p.table+'|'+p.col).join('\n'));
