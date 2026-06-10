/* =====================================================================
   PEPTIDE 101 v13 - LIVE DATA + PLATFORM INTEGRATION + TOOLS
   Loaded last. Adds:
     1) A live library-size stat in Module 6 pulled from /api/peptide-101/stats
        so the course reflects the real catalog (degrades silently if offline).
     2) A "Continue Your Research" cross-link card on the completion screen
        linking into the Research Library, Find A Peptide, AI Match and Lab
        Journal - tying the course into the wider platform.
     3) A handy mcg <-> mg unit converter in the Dosing module.
   Idempotent; inserts content, never wipes existing widgets or nav-ctrl.
   ===================================================================== */
(function(){
  function qs(s,r){return (r||document).querySelector(s);}
  function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstChild;}
  function ic(d,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="'+(w||16)+'" height="'+(w||16)+'" style="flex-shrink:0;">'+d+'</svg>';}
  function insertBeforeNav(id,node){ var sc=document.getElementById(id); if(!sc) return false; var nav=sc.querySelector('.nav-ctrl'); if(nav) sc.insertBefore(node,nav); else sc.appendChild(node); return true; }

  /* ---------- 1. live library size (Module 6) ---------- */
  function liveStat(){
    var s6=qs('#s6'); if(!s6 || qs('#v13stat')) return;
    var card=el('<div class="card" id="v13stat" style="border:1px solid rgba(0,196,188,.25);"><div style="display:flex;align-items:center;gap:12px;">'+
      '<div style="min-width:44px;height:44px;border-radius:12px;background:rgba(0,196,188,.14);display:flex;align-items:center;justify-content:center;color:var(--teal);">'+ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>',22)+'</div>'+
      '<div style="flex:1;"><div style="font-size:20px;font-weight:800;color:var(--teal);" id="v13statn">The Pep Nation Lab Library</div>'+
      '<div style="font-size:12px;color:var(--silver);">Every Family Above Is Fully Detailed In The Research Library.</div></div>'+
      '<a class="btn btn-secondary" href="/research" style="font-size:13px;">Open Library'+ic('<path d="M5 12h14M12 5l7 7-7 7"/>',15)+'</a></div></div>');
    var anchor=qs('#s6 #v13stat'); if(anchor) return;
    // place near the bottom of families, before the explorer link / nav
    insertBeforeNav('s6',card);
    fetch('/api/peptide-101/stats',{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
      if(j && typeof j.compounds==='number' && j.compounds>0){ var n=qs('#v13statn'); if(n) n.textContent=j.compounds+'+ Research Peptides To Explore'; }
    }).catch(function(){});
  }

  /* ---------- 2. continue your research (completion) ---------- */
  function researchLinks(){
    var s10=qs('#s10'); if(!s10 || qs('#v13next')) return;
    var links=[
      ['/research','Research Library','Deep Monographs On Every Compound','<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>'],
      ['/find-a-peptide','Find A Peptide','Discover Compounds By Goal','<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'],
      ['/research/match','AI Match','Get AI-Matched Research Suggestions','<path d="M12 2a10 10 0 1 0 10 10"/><path d="M8 12l3 3 5-6"/>'],
      ['/lab-journal','Lab Journal','Save Notes And Track Your Research','<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>']
    ];
    var rows=links.map(function(l){return '<a href="'+l[0]+'" style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface2);border-radius:10px;text-decoration:none;color:inherit;">'+
      '<span style="min-width:36px;height:36px;border-radius:9px;background:rgba(0,196,188,.12);display:flex;align-items:center;justify-content:center;color:var(--teal);">'+ic(l[3],18)+'</span>'+
      '<span style="flex:1;"><span style="display:block;font-weight:700;font-size:14px;">'+l[1]+'</span><span style="display:block;font-size:12px;color:var(--muted);">'+l[2]+'</span></span>'+
      ic('<path d="M9 18l6-6-6-6"/>',16)+'</a>';}).join('');
    var card=el('<div class="card" id="v13next"><h3 style="font-size:16px;margin-bottom:4px;">Continue Your Research</h3>'+
      '<p style="font-size:13px;color:var(--silver);margin:0 0 12px;">You Know The Fundamentals - Now Put Them To Work Across The Platform.</p>'+
      '<div style="display:grid;gap:8px;">'+rows+'</div></div>');
    s10.appendChild(card);
  }

  /* ---------- 3. mcg <-> mg converter (Dosing) ---------- */
  window.P101conv=function(){
    var inp=qs('#cvIn'), from=qs('#cvFrom'), out=qs('#cvOut'); if(!inp||!from||!out) return;
    var v=parseFloat(inp.value); if(isNaN(v)){ out.innerHTML=''; return; }
    if(from.value==='mg'){ out.innerHTML='<strong>'+v+' mg</strong> = <strong style="color:var(--teal);">'+(v*1000).toLocaleString()+' mcg</strong>'; }
    else { out.innerHTML='<strong>'+v.toLocaleString()+' mcg</strong> = <strong style="color:var(--teal);">'+(v/1000)+' mg</strong>'; }
  };
  function converter(){
    var s9=qs('#s9'); if(!s9 || qs('#v13conv')) return;
    var card=el('<div class="card" id="v13conv"><h3 style="font-size:15px;margin-bottom:6px;">Quick Unit Converter</h3>'+
      '<p style="font-size:13px;color:var(--muted);margin:0 0 10px;">Doses Jump Between Micrograms (mcg) And Milligrams (mg). Remember: 1 mg = 1000 mcg.</p>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'+
      '<input type="number" id="cvIn" class="calc-input" placeholder="Amount" aria-label="Amount To Convert" style="max-width:140px;margin:0;" oninput="P101conv()"/>'+
      '<select id="cvFrom" class="calc-input" aria-label="From Unit" style="max-width:110px;margin:0;" onchange="P101conv()"><option value="mcg">mcg</option><option value="mg">mg</option></select>'+
      '<div id="cvOut" style="font-size:14px;"></div>'+
      '</div></div>');
    insertBeforeNav('s9',card);
  }

  function ready(){ return !!(document.getElementById('s6') && document.getElementById('s9')); }
  function init(){
    if(window.__p101v13) return; window.__p101v13=1;
    try{ liveStat(); }catch(e){}
    try{ researchLinks(); }catch(e){}
    try{ converter(); }catch(e){}
  }
  function boot(){ if(ready()){init();return;} var n=0,t=setInterval(function(){ if(ready()||n++>160){clearInterval(t);init();} },40); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,240);});
  else setTimeout(boot,240);
})();
