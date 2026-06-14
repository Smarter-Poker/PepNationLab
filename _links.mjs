import fs from 'fs';import path from 'path';
// build set of existing page routes
const pages=new Set();
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(e.name.startsWith('(')||e.name==='api'){walk(p);continue;}walk(p);}else if(e.name==='page.tsx'||e.name==='page.ts'){let r='/'+path.relative('app',d).replace(/\\/g,'/');r=r.replace(/\/\([^)]+\)/g,'');if(r==='/.')r='/';pages.add(r==='/'?'/':r.replace(/\/$/,''));}}})('app');
// collect href="/literal" from tsx
const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.name.endsWith('.tsx'))files.push(p);}})('app');(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.name.endsWith('.tsx'))files.push(p);}})('components');
const re=/href=["'`](\/[a-zA-Z0-9_\/-]*)["'`]/g;
const linkSet=new Map();
for(const f of files){const src=fs.readFileSync(f,'utf8');let m;while((m=re.exec(src))){const href=m[1].replace(/\/$/,'')||'/';if(!linkSet.has(href))linkSet.set(href,f);}}
// a link matches if exact page exists, or a dynamic route segment matches
function routeExists(href){
  if(pages.has(href))return true;
  const segs=href.split('/').filter(Boolean);
  for(const p of pages){const ps=p.split('/').filter(Boolean);if(ps.length!==segs.length)continue;let ok=true;for(let i=0;i<ps.length;i++){if(ps[i].startsWith('[')) continue;if(ps[i]!==segs[i]){ok=false;break;}}if(ok)return true;}
  return false;
}
const missing=[];
for(const [href,f] of linkSet){if(href==='/'||href.startsWith('/api'))continue;if(!routeExists(href))missing.push(`${href}  <-  ${f}`);}
console.log('distinct internal links:',linkSet.size,'| pages:',pages.size,'| MISSING:',missing.length);
console.log([...new Set(missing)].sort().join('\n'));
