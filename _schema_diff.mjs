import fs from 'fs';
const pairs=JSON.parse(fs.readFileSync('/tmp/selpairs.json','utf8'));
const db=JSON.parse(fs.readFileSync('/tmp/dbcols.json','utf8'));
const out=[];
for(const {f,table,col} of pairs){
  const cols=db[table];
  if(cols===undefined) continue; // table not in our map (view/unknown) -> skip
  if(cols==='__VIEW__'||cols==='') continue; // view or unknown columns -> skip
  const set=new Set(cols.split(','));
  if(!set.has(col)) out.push(`${table}.${col}  <-  ${f}`);
}
const uniq=[...new Set(out)].sort();
console.log('POTENTIAL MISSING COLUMNS:',uniq.length);
console.log(uniq.join('\n'));
