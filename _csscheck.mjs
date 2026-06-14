import { chromium } from 'playwright';
import fs from 'fs';
const b=await chromium.launch();const p=await (await b.newContext()).newPage();
await p.setContent('<html><head></head><body></body></html>');
for(const f of ['app/globals.css','app/globals-round2.css']){
  const css=fs.readFileSync(f,'utf8');
  const res=await p.evaluate((css)=>{const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
    if(!st.sheet) return {ok:false,top:0};
    let media=0,decl=0;
    function walk(rules){for(const r of rules){ if(r.cssRules) {media++; walk(r.cssRules);} else if(r.style) decl++; }}
    walk(st.sheet.cssRules);
    return {ok:true,top:st.sheet.cssRules.length,groups:media,styleRules:decl};
  },css);
  console.log(f, JSON.stringify(res));
}
await b.close();
