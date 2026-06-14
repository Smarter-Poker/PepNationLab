import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:780},isMobile:true});await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1')}catch(e){}},uid);await ctx.addCookies(cookies);const p=await ctx.newPage();
await p.goto('https://pepnationlab.com/research/catalog',{waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(1500);
const out=await p.evaluate(()=>{
 const iw=innerWidth;
 const btn=[...document.querySelectorAll('button')].find(e=>{const r=e.getBoundingClientRect();return Math.round(r.right)===477;});
 function chainOf(el){let chain=[];let n=el;for(let i=0;i<6&&n&&n!==document.body;i++){const c=getComputedStyle(n);chain.push(n.tagName+'.'+(typeof n.className==='string'?n.className.slice(0,18):'')+'{'+c.display+(c.display.includes('grid')?' '+c.gridTemplateColumns.slice(0,28):'')+',fw:'+c.flexWrap+',pos:'+c.position+',w:'+Math.round(n.getBoundingClientRect().width)+',x:'+Math.round(n.getBoundingClientRect().x)+'}');n=n.parentElement;}return chain;}
 return btn?{text:(btn.innerText||'').trim().slice(0,20),rect:[Math.round(btn.getBoundingClientRect().x),Math.round(btn.getBoundingClientRect().width)],chain:chainOf(btn)}:'no 477 btn';
});
console.log(JSON.stringify(out,null,1));
await b.close();
