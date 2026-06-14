import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
// extract only the new appended block from globals-round2.css
const full=fs.readFileSync('app/globals-round2.css','utf8');
const NEW=full.slice(full.indexOf('MOBILE PORTRAIT FIT')-3);
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:360,height:740},deviceScaleFactor:3,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
await ctx.addCookies(cookies);const p=await ctx.newPage();const F='/tmp/verify.out';
for(const path of process.argv.slice(2)){
  try{
    await p.goto('https://pepnationlab.com'+path,{waitUntil:'domcontentloaded',timeout:18000});
    await p.waitForTimeout(700);
    const before=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    const parsed=await p.evaluate((css)=>{const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);return st.sheet?st.sheet.cssRules.length:-1;},NEW);
    await p.waitForTimeout(300);
    const after=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    fs.appendFileSync(F,`${path}  before=${before}  after=${after}  rulesParsed=${parsed}\n`);
  }catch(e){fs.appendFileSync(F,`${path}  ERR ${e.message.slice(0,45)}\n`);}
}
await b.close();
