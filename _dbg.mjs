import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const CSS=fs.readFileSync('app/globals-mobile-fit.css','utf8');
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:780},isMobile:true});await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1')}catch(e){}},uid);await ctx.addCookies(cookies);const p=await ctx.newPage();
await p.goto('https://pepnationlab.com/about',{waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(900);
await p.addStyleTag({content:CSS});
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(400);
const o=await p.evaluate(()=>{
 const pc=document.querySelector('.page-container');
 const cs=pc?getComputedStyle(pc):null;
 const foot=[...document.querySelectorAll('a,span,div')].find(e=>(e.innerText||'').includes('support@pep'));
 const nav=[...document.querySelectorAll('nav')].find(n=>getComputedStyle(n).position==='fixed'&&getComputedStyle(n).bottom==='0px');
 // chain of footer to see what container it's in
 let chain=[];if(foot){let n=foot;for(let i=0;i<6&&n&&n!==document.body;i++){const c=getComputedStyle(n);chain.push(n.tagName+'.'+(typeof n.className==='string'?n.className.slice(0,16):'')+'{mh:'+c.minHeight.slice(0,9)+',pb:'+c.paddingBottom+',pos:'+c.position+'}');n=n.parentElement;}}
 return {pcPadBottom:cs?cs.paddingBottom:null,pcMinH:cs?cs.minHeight:null, footBottom:foot?Math.round(foot.getBoundingClientRect().bottom):null, navTop:nav?Math.round(nav.getBoundingClientRect().top):null, docSH:document.body.scrollHeight, vh:innerHeight, chain};
});
console.log(JSON.stringify(o,null,1));
await b.close();
