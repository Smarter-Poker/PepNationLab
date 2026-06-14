import { chromium } from 'playwright';import fs from 'fs';
const b=await chromium.launch();const p=await(await b.newContext()).newPage();await p.setContent('<html><head></head><body></body></html>');
const css=fs.readFileSync('app/globals-mobile-fit.css','utf8');
const res=await p.evaluate((css)=>{const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);if(!st.sheet)return{ok:false};let n=0;const walk=(r)=>{for(const x of r){n++;if(x.cssRules)walk(x.cssRules);}};walk(st.sheet.cssRules);return{ok:true,rules:st.sheet.cssRules.length,total:n};},css);
console.log(JSON.stringify(res));await b.close();
