import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const CSS=fs.readFileSync('app/globals-mobile-fit.css','utf8');
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:375,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1');localStorage.setItem('pnl_disclaimer_v1.0','true')}catch(e){}},uid);await ctx.addCookies(cookies);const p=await ctx.newPage();
const jobs=process.argv.slice(2); // path:name:where(top|bottom)
for(const j of jobs){const [path,name,where]=j.split('::');
 try{
  await p.goto('https://pepnationlab.com'+path,{waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(1000);
  await p.addStyleTag({content:CSS});
  if(where==='bottom'){await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(1200);}
  else {await p.waitForTimeout(600);}
  await p.screenshot({path:'/sessions/nice-modest-mayer/mnt/outputs/v_'+name+'.png'});
 }catch(e){console.log(name,'ERR',e.message.slice(0,30));}
}
console.log('done');await b.close();
