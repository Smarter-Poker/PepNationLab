import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const CSS=fs.readFileSync('app/globals-mobile-fit.css','utf8');
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:375,height:780},isMobile:true});await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1');localStorage.setItem('pnl_disclaimer_v1.0','true')}catch(e){}},uid);await ctx.addCookies(cookies);const p=await ctx.newPage();
await p.goto('https://pepnationlab.com/account/help',{waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(1200);
await p.addStyleTag({content:CSS});await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(800);
const o=await p.evaluate(()=>{
 const pc=document.querySelector('.page-container');
 // last accordion button
 const btns=[...document.querySelectorAll('button')];
 const last=btns[btns.length-1];
 const lr=last?last.getBoundingClientRect():null;
 const nav=[...document.querySelectorAll('nav')].find(n=>getComputedStyle(n).position==='fixed'&&getComputedStyle(n).bottom==='0px');
 // walk from last button up, list min-heights and padding
 let chain=[];let n=last;for(let i=0;i<8&&n&&n!==document.documentElement;i++){const c=getComputedStyle(n);chain.push(n.tagName+'.'+(typeof n.className==='string'?n.className.slice(0,14):'')+'{mh:'+c.minHeight.slice(0,7)+',h:'+Math.round(n.getBoundingClientRect().height)+',pb:'+c.paddingBottom.slice(0,6)+'}');n=n.parentElement;}
 return {pcPad:pc?getComputedStyle(pc).paddingBottom:null, lastText:last?last.innerText.slice(0,20):null, lastBottom:lr?Math.round(lr.bottom):null, navTop:nav?Math.round(nav.getBoundingClientRect().top):null, vh:innerHeight, chain};
});
console.log(JSON.stringify(o,null,1));
await b.close();
