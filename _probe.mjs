import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1')}catch(e){}},uid);
await ctx.addCookies(cookies);const p=await ctx.newPage();
async function probe(url,textStarts){
 await p.goto('https://pepnationlab.com'+url,{waitUntil:'domcontentloaded',timeout:20000}).catch(()=>{});await p.waitForTimeout(1300);
 const info=await p.evaluate((textStarts)=>{
  const iw=innerWidth;
  const el=[...document.querySelectorAll('button,a,select,input,[role=button],span,div')].find(e=>{const r=e.getBoundingClientRect();return r.right>iw+2&&r.left>=-1&&r.left<iw&&(e.innerText||'').trim().startsWith(textStarts);});
  if(!el)return 'NOT FOUND: '+textStarts;
  const r=el.getBoundingClientRect();let chain=[];let n=el;for(let i=0;i<5&&n&&n!==document.body;i++){const c=getComputedStyle(n);chain.push(n.tagName+'.'+(typeof n.className==='string'?n.className:'').slice(0,22)+'{'+c.display+',fw:'+c.flexWrap+',ws:'+c.whiteSpace+',ox:'+c.overflowX+',w:'+Math.round(n.getBoundingClientRect().width)+'}');n=n.parentElement;}
  return {text:(el.innerText||'').trim().slice(0,30),tag:el.tagName,right:Math.round(r.right),width:Math.round(r.width),ws:getComputedStyle(el).whiteSpace,chain};
 },textStarts);
 console.log('### '+url+' :: '+textStarts);console.log(JSON.stringify(info,null,1));
}
await probe('/research/by-class','28-Amino');
await probe('/research/catalog','Default Sorting');
await probe('/admin/settings/shipping','No Assignment');
await probe('/lab-journal','Experiment');
await b.close();
