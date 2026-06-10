/* =====================================================================
   PEPTIDE 101 v11 - ANIMATION ENGINE
   Loaded last. Adds tasteful, reduced-motion-aware animation:
     1) Per-module staggered card entrance when a screen becomes active.
     2) An animated exponential DECAY CURVE in the Module 5 half-life
        explorer (wraps window.showHL, never replaces its behavior).
     3) A signal-cascade pulse in the Module 3 lock-and-key demo (wraps
        window.bindPeptide).
   Everything is feature-detected and wrapped, so if anything is missing the
   course behaves exactly as before. Honors prefers-reduced-motion.
   ===================================================================== */
(function(){
  function qs(s,r){return (r||document).querySelector(s);}
  function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstChild;}
  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function injectCSS(){
    if(document.getElementById('p101v11css')) return;
    var s=document.createElement('style'); s.id='p101v11css';
    s.textContent=
      '@keyframes p101fade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}'+
      '@keyframes p101draw{to{stroke-dashoffset:0}}'+
      '@keyframes p101pulse{0%{transform:scale(.4);opacity:.85}70%{transform:scale(2.6);opacity:0}100%{opacity:0}}'+
      '.p101-signal{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:var(--teal);box-shadow:0 0 12px var(--teal);pointer-events:none;animation:p101pulse 1s ease-out forwards;}'+
      (RM?'.p101anim{animation:none!important}':'');
    (document.head||document.documentElement).appendChild(s);
  }

  /* ---------- 1. per-module card entrance ---------- */
  function animateCards(screen){
    if(RM||!screen) return;
    qsa('.card, .card-nickel', screen).forEach(function(c,i){
      if(c.closest && c.closest('.ask-card')) return; // leave the tutor box calm
      c.style.animation='none'; void c.offsetWidth;
      c.style.animation='p101fade .5s ease '+(Math.min(i,8)*45)+'ms both';
    });
  }
  function perModuleReveal(){
    if(RM || typeof window.MutationObserver==='undefined') return;
    var mo=new MutationObserver(function(muts){
      muts.forEach(function(m){ if(m.attributeName==='class'){ var s=m.target; if(s.classList&&s.classList.contains('active')) animateCards(s); } });
    });
    qsa('.screen').forEach(function(s){ try{ mo.observe(s,{attributes:true,attributeFilter:['class']}); }catch(e){} });
    var active=qs('.screen.active'); if(active) setTimeout(function(){animateCards(active);},30);
  }

  /* ---------- 2. decay curve on half-life explorer ---------- */
  function drawDecay(name,hours,color){
    var res=qs('#hlResult'); if(!res || !(hours>0)) return;
    var box=qs('#hlCurve'); if(!box){ box=el('<div id="hlCurve" style="margin-top:14px;"></div>'); res.appendChild(box); }
    var W=300,H=92,pad=8, N=60, total=hours*4, pts=[];
    for(var i=0;i<=N;i++){ var t=total*i/N; var frac=Math.pow(0.5,t/hours); var x=pad+(W-2*pad)*(i/N); var y=pad+(H-2*pad)*(1-frac); pts.push(x.toFixed(1)+','+y.toFixed(1)); }
    var grids=[0.25,0.5,0.75].map(function(p){var x=pad+(W-2*pad)*p;return '<line x1="'+x.toFixed(1)+'" y1="'+pad+'" x2="'+x.toFixed(1)+'" y2="'+(H-pad)+'" stroke="rgba(90,102,117,.35)" stroke-dasharray="3,3"/><text x="'+x.toFixed(1)+'" y="'+(H-1)+'" fill="#5a6675" font-size="8" text-anchor="middle" font-family="Inter,sans-serif">'+( [1,2,3][[0.25,0.5,0.75].indexOf(p)] )+' HL</text>';}).join('');
    box.innerHTML='<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">How It Clears From The Body: '+esc(name)+'</div>'+
      '<svg viewBox="0 0 300 92" width="100%" aria-label="Decay curve for '+esc(name)+'">'+
      '<line x1="'+pad+'" y1="'+(H-pad)+'" x2="'+(W-pad)+'" y2="'+(H-pad)+'" stroke="#5a6675" stroke-width="1"/>'+
      '<line x1="'+pad+'" y1="'+pad+'" x2="'+pad+'" y2="'+(H-pad)+'" stroke="#5a6675" stroke-width="1"/>'+grids+
      '<path d="M'+pts.join(' L')+'" fill="none" stroke="'+color+'" stroke-width="2.5" stroke-linecap="round" class="p101curve p101anim"/>'+
      '</svg>';
    var path=box.querySelector('.p101curve');
    if(path && !RM){ try{ var len=(path.getTotalLength?path.getTotalLength():640)||640; path.style.strokeDasharray=len; path.style.strokeDashoffset=len; path.style.animation='p101draw 1.1s ease forwards'; }catch(e){} }
  }
  function wrapHL(){
    if(window.__p101hlwrap) return; var orig=window.showHL;
    if(typeof orig!=='function') return false; window.__p101hlwrap=1;
    window.showHL=function(name,hours,color){ try{ orig.apply(this,arguments); }catch(e){} try{ drawDecay(name,hours,color); }catch(e){} };
    return true;
  }

  /* ---------- 3. signal cascade on lock-key bind ---------- */
  function wrapBind(){
    if(window.__p101bindwrap) return; var orig=window.bindPeptide;
    if(typeof orig!=='function') return false; window.__p101bindwrap=1;
    window.bindPeptide=function(){
      try{ orig.apply(this,arguments); }catch(e){}
      if(RM) return;
      try{
        var rec=qs('#lkReceptor'); if(!rec) return;
        try{ if(window.getComputedStyle && getComputedStyle(rec).position==='static') rec.style.position='relative'; }catch(e){ rec.style.position='relative'; }
        for(var i=0;i<3;i++){ (function(delay){ setTimeout(function(){ try{ var p=el('<span class="p101-signal"></span>'); rec.appendChild(p); setTimeout(function(){ if(p&&p.parentNode) p.parentNode.removeChild(p); },1050); }catch(e){} }, delay); })(i*220); }
      }catch(e){}
    };
    return true;
  }

  function ready(){ return !!document.getElementById('s5'); }
  function init(){
    if(window.__p101v11) return; window.__p101v11=1;
    try{ injectCSS(); }catch(e){}
    try{ perModuleReveal(); }catch(e){}
    // globals may be (re)assigned by later engines; retry the wraps a few times
    var tries=0, t=setInterval(function(){ var a=wrapHL(), b=wrapBind(); if((a&&b)||tries++>40){ clearInterval(t); } },80);
  }
  function boot(){ if(ready()){init();return;} var n=0,t=setInterval(function(){ if(ready()||n++>160){clearInterval(t);init();} },40); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,200);});
  else setTimeout(boot,200);
})();
