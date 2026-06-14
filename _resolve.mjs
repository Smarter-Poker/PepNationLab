import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:800}});await ctx.addCookies(cookies);const p=await ctx.newPage();
async function firstHref(url,re){await p.goto('https://pepnationlab.com'+url,{waitUntil:'domcontentloaded',timeout:20000}).catch(()=>{});await p.waitForTimeout(1200);return await p.evaluate((re)=>{const rx=new RegExp(re);const a=[...document.querySelectorAll('a[href]')].map(x=>x.getAttribute('href')).find(h=>rx.test(h));return a||'';},re);}
const area=await firstHref('/research/areas','/research/area/');
const target=await firstHref('/research/by-target','/research/by-target/');
console.log('AREA='+area); console.log('TARGET='+target);
await b.close();
