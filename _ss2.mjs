import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});await ctx.addCookies(cookies);const p=await ctx.newPage();
await p.goto('https://pepnationlab.com/about',{waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(1500);
// describe the two elements
const info=await p.evaluate(()=>{
 function desc(text){const el=[...document.querySelectorAll('button,a,[role=button]')].find(e=>(e.innerText||'').trim().startsWith(text));if(!el)return null;const r=el.getBoundingClientRect();const cs=getComputedStyle(el);let par=el.parentElement,chain=[];for(let i=0;i<4&&par;i++){chain.push(par.tagName+'.'+(par.className||'').toString().slice(0,18)+'{'+getComputedStyle(par).position+',ox:'+getComputedStyle(par).overflowX+'}');par=par.parentElement;}return {text,rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},pos:cs.position,chain};}
 return {ad:desc('Admin Dashboard'),fu:desc('Find User'),nav: (()=>{const n=[...document.querySelectorAll('nav')].find(n=>getComputedStyle(n).position==='fixed'&&getComputedStyle(n).bottom==='0px');return n?{top:Math.round(n.getBoundingClientRect().top)}:null;})()};
});
console.log(JSON.stringify(info,null,1));
await p.screenshot({path:'/tmp/about360.png',fullPage:false});
await p.screenshot({path:'/tmp/about360full.png',fullPage:true});
await b.close();
