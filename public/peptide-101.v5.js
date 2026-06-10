/* =====================================================================
   PEPTIDE 101 v5 - ACCOUNT-BOUND PROGRESS + MASTERY
   Loaded after v3/v4. Mirrors the v3 progress blob (localStorage
   'p101_progress_v3') to the logged-in researcher's account via
   /api/peptide-101/progress, so progress follows them across devices and
   admins can see course completion. Non-invasive: treats v3 state as an
   opaque blob; pulls a newer server copy on load (one reload), then mirrors
   local writes up. Falls back silently to device-only if signed out.
   ===================================================================== */
(function(){
  var LS='p101_progress_v3';
  var API='/api/peptide-101/progress';
  var SESS='p101_v5_pulled';
  var TOTAL=13;
  var authed=null; // null unknown, true signed-in, false signed-out
  function qs(s){return document.querySelector(s);}
  function el(h){var d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild;}
  function ic(d){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0;">'+d+'</svg>';}
  function readLocal(){ try{return JSON.parse(localStorage.getItem(LS)||'{}')||{};}catch(e){return {};} }
  function doneCount(st){ return st&&st.done?Object.keys(st.done).length:0; }
  function mag(st){ st=st||{}; var ex=st.exam||{}; return doneCount(st) + (ex.passed?1000:0) + (ex.best||0)/10000; }

  function toServer(){
    var st=readLocal();
    var screen='s0'; try{screen='s'+(parseInt(localStorage.getItem('p101_screen'),10)||0);}catch(e){}
    var ex=st.exam||{};
    return {
      current_screen: screen,
      completed_modules: st.done?Object.keys(st.done):[],
      quiz_scores: { state: st, exam_best: ex.best||0 },
      assessment_score: ex.best||0,
      assessment_total: 100,
      certified: !!ex.passed
    };
  }

  var pushT=null;
  function pushUp(now){
    if(authed===false) return;
    clearTimeout(pushT);
    var fire=function(){
      try{
        fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(toServer()),keepalive:true,credentials:'same-origin'})
        .then(function(r){ authed = (r.status!==401); updateBanner(); }).catch(function(){});
      }catch(e){}
    };
    if(now) fire(); else pushT=setTimeout(fire,1500);
  }

  function patchSetItem(){
    if(window.__p101v5patch) return; window.__p101v5patch=1;
    try{
      var orig=localStorage.setItem.bind(localStorage);
      localStorage.setItem=function(k,v){ orig(k,v); if(k===LS){ pushUp(false); updateBanner(); } };
    }catch(e){}
    window.addEventListener('pagehide',function(){pushUp(true);});
    document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='hidden') pushUp(true); });
  }

  function applyServerAndReload(blob,screen){
    try{ localStorage.setItem(LS, JSON.stringify(blob)); }catch(e){}
    if(screen){ try{ localStorage.setItem('p101_screen', String(parseInt(String(screen).replace('s',''),10)||0)); }catch(e){} }
    try{ sessionStorage.setItem(SESS,'1'); }catch(e){}
    location.reload();
  }

  function pull(){
    fetch(API,{credentials:'same-origin'}).then(function(r){
      if(r.status===401){ authed=false; try{sessionStorage.setItem(SESS,'1');}catch(e){} updateBanner(); return null; }
      authed=true; return r.json();
    }).then(function(j){
      if(authed===false) return;
      try{ sessionStorage.setItem(SESS,'1'); }catch(e){}
      var p=j&&j.progress;
      var serverBlob=(p&&p.quiz_scores&&p.quiz_scores.state)?p.quiz_scores.state:null;
      var local=readLocal();
      if(serverBlob && mag(serverBlob) > mag(local)+1e-9){
        applyServerAndReload(serverBlob, p.current_screen);
        return;
      }
      pushUp(true);
      updateBanner();
    }).catch(function(){ updateBanner(); });
  }

  /* ---------- ACCOUNT BANNER on s0 ---------- */
  function bannerHTML(){
    var st=readLocal(); var c=Math.min(doneCount(st),TOTAL); var pct=Math.round(c/TOTAL*100);
    var ex=st.exam||{}; var best=ex.best||0; var passed=!!ex.passed;
    var status, warn=false;
    if(authed===true){ status='Progress Saved To Your Account'; }
    else if(authed===false){ status='Progress Saved On This Device Only - Sign In To Sync'; warn=true; }
    else { status='Syncing Your Progress...'; }
    var bord=warn?'rgba(229,62,62,.40)':'rgba(0,196,188,.35)';
    var bg=warn?'rgba(229,62,62,.08)':'rgba(0,196,188,.08)';
    var fg=warn?'var(--red)':'var(--teal)';
    var dot='<span style="width:3px;height:3px;border-radius:50%;background:var(--muted);display:inline-block;"></span>';
    var stats='<span>'+pct+'% Complete</span>'+dot+'<span>'+c+' Of '+TOTAL+' Modules</span>'+(best?dot+'<span>Best Assessment '+best+'%'+(passed?' - Passed':'')+'</span>':'');
    return '<div id="acctProg" role="status" aria-live="polite" style="margin:0 0 16px;padding:12px 14px;border-radius:12px;border:1px solid '+bord+';background:'+bg+';">'+
      '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:'+fg+';font-weight:700;">'+ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>')+'<span>'+status+'</span></div>'+
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:6px;">'+stats+'</div></div>';
  }
  function updateBanner(){
    var host=qs('#s0'); if(!host) return;
    var node=el(bannerHTML());
    var existing=qs('#acctProg');
    if(existing){ existing.parentNode.replaceChild(node,existing); return; }
    var hero=qs('#s0 .hero-card');
    if(hero&&hero.parentNode){ hero.parentNode.insertBefore(node, hero.nextSibling); }
    else host.insertBefore(node, host.firstChild);
  }

  /* ---------- Review / retake on completion ---------- */
  function goScreen(id){
    if(window.P101&&P101.go){ P101.go(id); return; }
    var s=document.getElementById(id); if(!s) return;
    document.querySelectorAll('.screen').forEach(function(x){x.classList.remove('active');});
    s.classList.add('active'); try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){window.scrollTo(0,0);}
  }
  function addReview(){
    var cl=qs('#continueLearning'); if(!cl||qs('#p101review')) return;
    var wrap=el('<div class="lib-links" style="margin-top:8px;"><button class="lib-link" id="p101review">'+ic('<path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.7 3"/><path d="M3 3v5h5"/>')+'Review And Retake Assessment</button></div>');
    wrap.querySelector('#p101review').addEventListener('click',function(){ goScreen(document.getElementById('s15')?'s15':'s0'); });
    cl.appendChild(wrap);
  }

  function ready(){ return !!document.getElementById('s0'); }
  function init(){
    if(window.__p101v5) return; window.__p101v5=1;
    patchSetItem();
    updateBanner();
    addReview();
    var pulled=false; try{ pulled=sessionStorage.getItem(SESS)==='1'; }catch(e){}
    if(pulled){ pushUp(true); } else { pull(); }
    var bt=null;
    document.addEventListener('click',function(){ clearTimeout(bt); bt=setTimeout(updateBanner,80); });
  }
  function boot(){ if(ready()){init();return;} var n=0,t=setInterval(function(){ if(ready()||n++>80){clearInterval(t);init();} },40); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,30);});
  else setTimeout(boot,30);
})();
