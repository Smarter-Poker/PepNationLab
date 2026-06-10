/* =====================================================================
   PEPTIDE 101 v12 - NAVIGATION + MOBILE
   Loaded last. Adds:
     1) A thin reading-progress bar pinned to the very top that tracks how
        far you have scrolled through the current module.
     2) A floating "Modules" button that opens a switcher drawer listing all
        modules with their completion state, so a learner can jump anywhere
        (and resume the first unfinished module). Mobile-friendly bottom sheet.
     3) Scroll-margin so headings never hide behind the fixed header.
   Read-only DOM + window.goTo; nothing about completion tracking changes.
   ===================================================================== */
(function(){
  function qs(s,r){return (r||document).querySelector(s);}
  function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstChild;}
  function ic(d,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="'+(w||16)+'" height="'+(w||16)+'" style="flex-shrink:0;">'+d+'</svg>';}

  // Module order + titles (content modules, then assessment + certificate).
  var MODS=[
    ['s1','What Is A Peptide?'],['s2','What Peptides Do'],['s3','The Lock And Key'],
    ['s4','What Peptides Are Studied For'],['s5','Handling And Storage'],['s6','Peptide Families'],
    ['s7','Stacking And Protocols'],['s8','Reconstitution Calculator'],['s9','Dosing Reference'],
    ['s11','What Peptides Are NOT'],['s12','Why Peptides Are Injected'],['s13','Safety, Purity And Sourcing'],
    ['s14','Legality And Research Use'],['s15','Final Assessment'],['s10','Certificate']
  ];
  var CONTENT=['s1','s2','s3','s4','s5','s6','s7','s8','s9','s11','s12','s13','s14'];

  function done(){ try{ var st=JSON.parse(localStorage.getItem('p101_progress_v3')||'{}'); return (st&&st.done)||{}; }catch(e){ return {}; } }
  function go(id){ try{ if(window.P101&&window.P101.go) window.P101.go(id); else if(window.goTo) window.goTo(id); }catch(e){} }

  function injectCSS(){
    if(document.getElementById('p101v12css')) return;
    var s=document.createElement('style'); s.id='p101v12css';
    s.textContent=
      '#p101rb{position:fixed;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,var(--teal),var(--blue));z-index:200;transition:width .12s ease;pointer-events:none;}'+
      '.screen h2,.screen h3,.screen [id]{scroll-margin-top:172px;}'+
      '#p101tocbtn{position:fixed;right:16px;bottom:16px;z-index:150;display:inline-flex;align-items:center;gap:7px;padding:11px 15px;border-radius:999px;border:1px solid rgba(0,196,188,.5);background:rgba(7,13,24,.92);backdrop-filter:blur(8px);color:var(--teal);font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.45);}'+
      '#p101tocov{position:fixed;inset:0;z-index:9998;background:rgba(2,6,12,.6);opacity:0;visibility:hidden;transition:opacity .2s ease;}'+
      '#p101tocov.open{opacity:1;visibility:visible;}'+
      '#p101toc{position:fixed;top:0;right:0;height:100dvh;width:340px;max-width:88vw;z-index:9999;background:#0c141f;border-left:1px solid var(--border);transform:translateX(100%);transition:transform .26s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;}'+
      '#p101toc.open{transform:none;}'+
      '.p101toc-row{display:flex;align-items:center;gap:11px;padding:11px 16px;cursor:pointer;border-bottom:1px solid rgba(150,168,192,.08);color:var(--silver);}'+
      '.p101toc-row:hover{background:var(--surface2);}'+
      '.p101toc-row.cur{background:rgba(0,196,188,.1);color:#fff;}'+
      '.p101toc-n{min-width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:var(--surface2);color:var(--muted);}'+
      '.p101toc-row.is-done .p101toc-n{background:var(--teal);color:#001;}'+
      '@media(max-width:600px){#p101toc{top:auto;bottom:0;right:0;left:0;width:100%;max-width:100%;height:80dvh;border-left:none;border-top:1px solid var(--border);border-radius:16px 16px 0 0;transform:translateY(100%);}#p101toc.open{transform:none;}#p101tocbtn{bottom:14px;right:14px;}}';
    (document.head||document.documentElement).appendChild(s);
  }

  /* ---------- reading progress ---------- */
  function updateRB(){
    var rb=qs('#p101rb'); if(!rb) return;
    var docH=(document.documentElement.scrollHeight||document.body.scrollHeight)-window.innerHeight;
    var pct=docH>0?Math.max(0,Math.min(1,(window.scrollY||window.pageYOffset||0)/docH)):0;
    rb.style.width=(pct*100).toFixed(1)+'%';
  }

  /* ---------- drawer ---------- */
  function rowsHTML(){
    var dn=done(), cur=null; var a=qs('.screen.active'); if(a) cur=a.id;
    return MODS.map(function(m,i){
      var isDone=!!dn[m[0]]; var isCur=m[0]===cur;
      var mark=isDone?ic('<path d="M20 6 9 17l-5-5"/>',14):(i+1);
      return '<div class="p101toc-row'+(isDone?' is-done':'')+(isCur?' cur':'')+'" data-go="'+m[0]+'" role="button" tabindex="0">'+
        '<span class="p101toc-n">'+(isDone?ic('<path d="M20 6 9 17l-5-5"/>',14):(i<13?(i+1):''))+'</span>'+
        '<span style="flex:1;font-size:13px;">'+m[1]+'</span>'+(isCur?'<span style="font-size:10px;color:var(--teal);">Now</span>':'')+'</div>';
    }).join('');
  }
  function firstUnfinished(){ var dn=done(); for(var i=0;i<CONTENT.length;i++){ if(!dn[CONTENT[i]]) return CONTENT[i]; } return 's10'; }
  function build(){
    if(qs('#p101toc')) return;
    var btn=el('<button id="p101tocbtn" aria-label="Open Course Modules" aria-haspopup="dialog">'+ic('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',16)+'Modules</button>');
    var ov=el('<div id="p101tocov"></div>');
    var panel=el('<aside id="p101toc" role="dialog" aria-label="Course Modules" aria-modal="true"></aside>');
    panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);"><strong style="font-size:15px;">Course Modules</strong><button id="p101tocx" aria-label="Close" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:6px;">'+ic('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',20)+'</button></div>'+
      '<button id="p101resume" class="btn btn-primary" style="margin:12px 16px;font-size:13px;">'+ic('<path d="M5 3l14 9-14 9V3z"/>',15)+'Resume Where I Left Off</button>'+
      '<div id="p101toclist" style="overflow-y:auto;flex:1;"></div>';
    document.body.appendChild(btn); document.body.appendChild(ov); document.body.appendChild(panel);
    btn.addEventListener('click',function(){ openTOC(true); });
    ov.addEventListener('click',function(){ openTOC(false); });
    qs('#p101tocx',panel).addEventListener('click',function(){ openTOC(false); });
    qs('#p101resume',panel).addEventListener('click',function(){ go(firstUnfinished()); openTOC(false); });
    panel.addEventListener('click',function(e){ var row=e.target.closest&&e.target.closest('[data-go]'); if(row){ go(row.getAttribute('data-go')); openTOC(false); } });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') openTOC(false); });
  }
  function openTOC(open){
    var ov=qs('#p101tocov'), panel=qs('#p101toc'), list=qs('#p101toclist'); if(!panel) return;
    if(open){ if(list) list.innerHTML=rowsHTML(); ov.classList.add('open'); panel.classList.add('open'); }
    else { ov.classList.remove('open'); panel.classList.remove('open'); }
  }
  window.P101toc=openTOC;

  function ready(){ return !!(document.getElementById('s1') && qs('.app')); }
  function init(){
    if(window.__p101v12) return; window.__p101v12=1;
    try{ injectCSS(); }catch(e){}
    try{ if(!qs('#p101rb')) document.body.appendChild(el('<div id="p101rb"></div>')); }catch(e){}
    try{ build(); }catch(e){}
    window.addEventListener('scroll',updateRB,{passive:true});
    window.addEventListener('resize',updateRB);
    updateRB(); setTimeout(updateRB,400);
  }
  function boot(){ if(ready()){init();return;} var n=0,t=setInterval(function(){ if(ready()||n++>160){clearInterval(t);init();} },40); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,220);});
  else setTimeout(boot,220);
})();
