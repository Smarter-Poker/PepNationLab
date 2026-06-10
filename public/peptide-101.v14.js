/* =====================================================================
   PEPTIDE 101 v14 - PAGINATED MODULE FLOW + DEEP VISUAL LAYER
   Reusable intra-module "stepper": each module becomes a sequence of
   single-focus pages with Next/Back instead of one long scroll.
   Phase 1 ships the redesigned Module 1 as the template. Runs after the
   v3 engine (app.js) + v4; owns the inner content of the screens it
   redesigns. Idempotent. No global redeclarations.
   ===================================================================== */
(function(){
  if (window.__p101v14) return; window.__p101v14 = 1;

  var D = document;
  function E(tag, cls, html){ var n=D.createElement(tag); if(cls) n.className=cls; if(html!=null) n.innerHTML=html; return n; }
  function qs(s,r){ return (r||D).querySelector(s); }
  function go(id){ if(window.P101 && P101.go) P101.go(id); else if(window.goTo){ var m=String(id).match(/\d+/); if(m) window.goTo(+m[0]); } }
  function goModule(n){ if(window.goTo) window.goTo(n); else go('s'+n); }

  /* ---------------- STYLES ---------------- */
  function injectCSS(){
    if (D.getElementById('p101v14css')) return;
    var css = ''
    + '.v14{max-width:760px;margin:0 auto;}'
    + '.v14-stage{position:relative;}'
    + '.course-nav-wrap{display:none!important;}'
    + '.v14-track{display:flex;gap:6px;margin:2px 0 22px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;}'
    + '.v14-track::-webkit-scrollbar{display:none;}'
    + '.v14-step{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:7px 14px 7px 7px;border-radius:999px;cursor:pointer;border:1px solid transparent;background:linear-gradient(180deg,#0e1b30,#0a1322);transition:all .2s;opacity:.55;}'
    + '.v14-step .num{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;color:#9fb0c2;background:#16263f;box-shadow:inset 0 1px 2px rgba(0,0,0,.6);flex-shrink:0;}'
    + '.v14-step .lbl{font-size:12.5px;font-weight:600;color:#aebccb;white-space:nowrap;}'
    + '.v14-step.on{opacity:1;border-color:rgba(126,179,255,.45);background:linear-gradient(180deg,#16294a,#0e1d34);box-shadow:0 0 14px rgba(59,130,246,.28);}'
    + '.v14-step.on .num{color:#eaf2fb;background:linear-gradient(180deg,#3b6ea8,#1d3357);box-shadow:0 0 8px rgba(94,160,255,.6);}'
    + '.v14-step.on .lbl{color:#eaf2fb;}'
    + '.v14-step.done{opacity:.95;}'
    + '.v14-step.done .num{color:#0a1322;background:#2de0d8;}'
    + '.v14-step:not(.on):hover{opacity:.85;}'
    + '@media(max-width:640px){.v14-step .lbl{display:none;} .v14-step.on .lbl{display:inline;}}'
    + '.v14-page{display:none;animation:v14in .35s cubic-bezier(.22,.61,.36,1);}'
    + '.v14-page.on{display:block;}'
    + '@keyframes v14in{from{opacity:0;transform:translateY(14px) scale(.99);}to{opacity:1;transform:none;}}'
    + '.v14-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#7fb3ff;padding:6px 12px;border-radius:999px;margin-bottom:14px;background:linear-gradient(180deg,#15243c,#0c1626);border:1px solid rgba(126,179,255,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);}'
    + '.v14-h{font-family:"Space Grotesk",sans-serif;font-weight:800;font-size:clamp(25px,4.4vw,34px);line-height:1.08;margin:0 0 12px;background:linear-gradient(180deg,#ffffff,#b9c6d8 70%,#7f8ea3);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 1px rgba(0,0,0,.5));}'
    + '.v14-lead{font-size:16px;line-height:1.65;color:#c4d0dd;margin:0 0 20px;}'
    + '.v14-lead b{color:#fff;}'
    + '.v14-stage-frame{border-radius:22px;padding:26px;margin:0 0 20px;position:relative;overflow:hidden;border:1.5px solid transparent;background:linear-gradient(180deg,#0f1f37,#0a1322) padding-box,linear-gradient(155deg,#e4ebf2 0%,#9aa7b6 22%,#48566b 52%,#76828f 80%,#c4cdd7 100%) border-box;box-shadow:0 24px 60px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.08);}'
    + '.v14-stage-frame::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 50% -10%,rgba(94,160,255,.18),transparent 60%);pointer-events:none;}'
    + '.v14-svg{display:block;width:100%;height:auto;position:relative;z-index:1;}'
    + '.v14-bridge{display:flex;gap:13px;align-items:flex-start;border-radius:16px;padding:15px 18px;margin:0 0 20px;border:1.5px solid transparent;background:linear-gradient(180deg,#102139,#0a1322) padding-box,linear-gradient(155deg,#dbe3eb,#566270,#aeb9c5) border-box;box-shadow:0 8px 22px rgba(0,0,0,.45),inset 4px 0 0 #5ea0ff;}'
    + '.v14-bridge svg{width:22px;height:22px;color:#5ea0ff;flex-shrink:0;margin-top:1px;}'
    + '.v14-bridge p{margin:0;font-size:13.5px;line-height:1.55;color:#dbe6f2;}'
    + '.v14-bridge b{color:#fff;}'
    + '.v14-cards{display:grid;gap:13px;}'
    + '.v14-cards.c3{grid-template-columns:1fr 1fr 1fr;}'
    + '@media(max-width:640px){.v14-cards.c3{grid-template-columns:1fr;}}'
    + '.v14-card{border-radius:17px;padding:18px;border:1.5px solid transparent;background:linear-gradient(180deg,#13233c,#0b1626) padding-box,linear-gradient(155deg,#cdd7e2,#4f5a68,#9eaab7) border-box;box-shadow:0 10px 26px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.05);}'
    + '.v14-card h4{font-family:"Space Grotesk",sans-serif;font-size:15px;color:#eaf2fb;margin:10px 0 5px;}'
    + '.v14-card p{font-size:12.8px;line-height:1.5;color:#aebccb;margin:0;}'
    + '.v14-ic{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;border:1.5px solid transparent;background:radial-gradient(circle at 50% 28%,#1c3050,#0a1322) padding-box,linear-gradient(155deg,#dde5ee,#56616f,#aab5c2) border-box;box-shadow:inset 0 2px 7px rgba(0,0,0,.55),0 0 16px rgba(59,130,246,.22);}'
    + '.v14-ic svg{width:25px;height:25px;color:#8fc0ff;}'
    + '.v14-scale{display:flex;align-items:stretch;gap:0;border-radius:16px;overflow:hidden;border:1px solid rgba(150,170,200,.2);box-shadow:inset 0 2px 8px rgba(0,0,0,.5);}'
    + '.v14-scale > div{padding:16px;text-align:center;}'
    + '.v14-scale .pep{flex:0 0 40%;background:linear-gradient(180deg,rgba(0,196,188,.14),rgba(0,196,188,.04));border-right:1px solid rgba(150,170,200,.18);}'
    + '.v14-scale .pro{flex:1;background:linear-gradient(180deg,rgba(59,130,246,.14),rgba(59,130,246,.04));}'
    + '.v14-scale .big{font-family:"Space Grotesk",sans-serif;font-size:26px;font-weight:800;line-height:1;}'
    + '.v14-scale .pep .big{color:#2de0d8;} .v14-scale .pro .big{color:#7fb3ff;}'
    + '.v14-scale .cap{font-size:11px;color:#9fb0c2;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;}'
    + '.v14-scale .nm{font-size:13px;font-weight:700;color:#eaf2fb;margin-top:7px;}'
    + '.v14-q{border-radius:16px;padding:18px;margin-bottom:13px;border:1.5px solid transparent;background:linear-gradient(180deg,#0f1f37,#0a1322) padding-box,linear-gradient(155deg,#cdd7e2,#4f5a68,#9eaab7) border-box;box-shadow:0 8px 22px rgba(0,0,0,.4);}'
    + '.v14-q .qn{font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#9fb0c2;font-weight:700;margin-bottom:7px;}'
    + '.v14-q .qt{font-size:15.5px;color:#eaf1f8;margin-bottom:12px;line-height:1.4;}'
    + '.v14-opt{display:flex;align-items:center;gap:11px;width:100%;text-align:left;cursor:pointer;font-size:14px;font-weight:500;color:#e7eef6;padding:12px 15px;margin-bottom:8px;border-radius:11px;border:1px solid transparent;background:linear-gradient(180deg,#15243c,#0c1626) padding-box,linear-gradient(155deg,#cfd9e3,#5a6675,#aeb9c5) border-box;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);transition:transform .12s,box-shadow .2s;}'
    + '.v14-opt:hover{transform:translateY(-1px);}'
    + '.v14-opt .dot{width:18px;height:18px;border-radius:50%;border:2px solid #6d7a8a;flex-shrink:0;transition:all .2s;}'
    + '.v14-opt.right{color:#9af0d6;background:linear-gradient(180deg,#0f2a25,#0a1c1a) padding-box,linear-gradient(155deg,#a6f0df,#1f8f7d,#7fe0cf) border-box;}'
    + '.v14-opt.right .dot{border-color:#22c55e;background:#22c55e;box-shadow:0 0 10px rgba(34,197,94,.6);}'
    + '.v14-opt.wrong{color:#f7b4b4;background:linear-gradient(180deg,#2a1414,#1c0e0e) padding-box,linear-gradient(155deg,#f0a6a6,#8f1f1f,#e07f7f) border-box;}'
    + '.v14-opt.wrong .dot{border-color:#E53E3E;background:#E53E3E;}'
    + '.v14-fb{font-size:12.8px;line-height:1.55;color:#cfe0f5;margin-top:6px;padding:11px 13px;border-radius:10px;background:rgba(0,196,188,.07);border-left:3px solid var(--teal,#00C4BC);display:none;}'
    + '.v14-fb.show{display:block;animation:v14in .25s ease;}'
    + '.v14-recap{border-radius:16px;padding:16px 18px;margin-top:6px;border:1.5px solid transparent;background:linear-gradient(180deg,#0f1f37,#0a1322) padding-box,linear-gradient(155deg,#e4ebf2,#56616f,#aab5c2) border-box;box-shadow:0 8px 22px rgba(0,0,0,.45);}'
    + '.v14-recap h4{display:flex;align-items:center;gap:8px;font-size:14px;color:#eaf2fb;margin:0 0 10px;}'
    + '.v14-recap h4 svg{width:17px;height:17px;color:var(--teal,#00C4BC);}'
    + '.v14-recap li{display:flex;gap:9px;align-items:flex-start;font-size:13px;color:#cdd9e6;line-height:1.5;margin-bottom:7px;list-style:none;}'
    + '.v14-recap li svg{width:15px;height:15px;color:var(--teal,#00C4BC);flex-shrink:0;margin-top:2px;}'
    + '.v14-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:24px;}'
    + '.v14-dots{display:flex;gap:7px;}'
    + '.v14-dots i{width:8px;height:8px;border-radius:50%;background:#26344a;box-shadow:inset 0 1px 2px rgba(0,0,0,.6);transition:all .3s;cursor:pointer;}'
    + '.v14-dots i.on{background:linear-gradient(180deg,#7fb3ff,#3b6ea8);box-shadow:0 0 9px rgba(94,160,255,.7);transform:scale(1.25);}'
    + '.v14-dots i.done{background:#2de0d8;}'
    + '.v14-btn{display:inline-flex;align-items:center;gap:9px;cursor:pointer;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px;border:1px solid transparent;transition:transform .15s,box-shadow .2s;}'
    + '.v14-btn svg{width:17px;height:17px;}'
    + '.v14-next{color:#0a1322;background:linear-gradient(180deg,#f3f7fb,#cbd5e1 30%,#94a0b0 60%,#e7eef5);border-color:#dbe3ec;box-shadow:0 8px 20px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.9),inset 0 -3px 7px rgba(0,0,0,.3);text-shadow:0 1px 0 rgba(255,255,255,.5);}'
    + '.v14-next:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(0,0,0,.55),0 0 20px rgba(94,160,255,.4);}'
    + '.v14-back{color:#cdd9e6;background:linear-gradient(180deg,#172742,#0c1626) padding-box,linear-gradient(155deg,#cfd9e3,#5a6675,#aeb9c5) border-box;}'
    + '.v14-back:hover{color:#fff;transform:translateY(-1px);}'
    + '.v14-back.hidden{visibility:hidden;}'
    + '.v14-float{transform-origin:center;animation:v14float 5.5s ease-in-out infinite;}'
    + '.v14-spin{transform-origin:center;animation:v14spin 26s linear infinite;}'
    + '.v14-pulse{animation:v14pulse 3s ease-in-out infinite;}'
    + '@keyframes v14float{0%,100%{transform:translateY(0);}50%{transform:translateY(-9px);}}'
    + '@keyframes v14spin{to{transform:rotate(360deg);}}'
    + '@keyframes v14pulse{0%,100%{opacity:.5;}50%{opacity:1;}}'
    + '@media(prefers-reduced-motion:reduce){.v14-float,.v14-spin,.v14-pulse,.v14-page{animation:none!important;}}'
    ;
    var st = D.createElement('style'); st.id='p101v14css'; st.textContent=css; D.head.appendChild(st);
  }

  /* ---------------- SHARED SVG DEFS (injected once) ---------------- */
  function injectDefs(){
    if (D.getElementById('p101v14defs')) return;
    var svg = '<svg id="p101v14defs" width="0" height="0" style="position:absolute;overflow:hidden;" aria-hidden="true"><defs>'
      + '<radialGradient id="v14bead" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="#d8ecff"/><stop offset="45%" stop-color="#4f93e6"/><stop offset="100%" stop-color="#13315e"/></radialGradient>'
      + '<radialGradient id="v14beadT" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="#c9fff6"/><stop offset="45%" stop-color="#15b8ad"/><stop offset="100%" stop-color="#06403c"/></radialGradient>'
      + '<linearGradient id="v14bond" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#9fc4ff"/><stop offset="100%" stop-color="#2a4c7d"/></linearGradient>'
      + '<linearGradient id="v14dk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,196,188,.4)"/><stop offset="100%" stop-color="rgba(0,196,188,0)"/></linearGradient>'
      + '<filter id="v14sh" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity="0.5"/></filter>'
      + '</defs></svg>';
    var d = D.createElement('div'); d.innerHTML = svg; D.body.appendChild(d.firstChild);
  }

  function beadChain(n, teal, W, H, r){
    W=W||620; H=H||200; r=r||26;
    var cx=r+10, gap=(W-2*(r+10))/(n-1), y=H/2;
    var s='<svg class="v14-svg" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
    s+='<ellipse cx="'+(W/2)+'" cy="'+(H-Math.max(10,r*0.6))+'" rx="'+(W*0.38)+'" ry="'+Math.max(7,r*0.45)+'" fill="#05101f" opacity="0.5"/>';
    var g = teal?'url(#v14beadT)':'url(#v14bead)';
    for(var i=0;i<n-1;i++){ var x1=cx+gap*i, x2=cx+gap*(i+1); s+='<line x1="'+x1+'" y1="'+y+'" x2="'+x2+'" y2="'+y+'" stroke="url(#v14bond)" stroke-width="'+Math.max(4,r*0.34)+'" stroke-linecap="round" opacity="0.95"/>'; }
    s+='<g class="v14-float">';
    for(var j=0;j<n;j++){ var x=cx+gap*j; s+='<g filter="url(#v14sh)"><circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+g+'"/><ellipse cx="'+(x-r*0.28)+'" cy="'+(y-r*0.34)+'" rx="'+(r*0.32)+'" ry="'+(r*0.2)+'" fill="#ffffff" opacity="0.55"/></g>'; }
    s+='</g></svg>';
    return s;
  }

  /* ---------------- STEPPER FRAMEWORK ---------------- */
  var ARR_R='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  var ARR_L='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
  function buildStepper(screen, steps, prevModule, nextModule, labels, opts){
    screen.innerHTML='';
    var wrap = E('div','v14');

    var track=null;
    if(labels && labels.length===steps.length){
      track = E('div','v14-track');
      labels.forEach(function(lb,i){
        var st=E('div','v14-step'+(i===0?' on':''),'<span class="num">'+(i+1)+'</span><span class="lbl">'+lb+'</span>');
        st.setAttribute('data-s',i); track.appendChild(st);
      });
      wrap.appendChild(track);
    }

    var stage = E('div','v14-stage');
    wrap.appendChild(stage);
    steps.forEach(function(html,i){ var p=E('div','v14-page'+(i===0?' on':''),html); p.setAttribute('data-step',i); stage.appendChild(p); });

    var foot = E('div','v14-foot');
    var back = E('button','v14-btn v14-back hidden', ARR_L+'Back');
    var dots = E('div','v14-dots');
    steps.forEach(function(_,i){ var d=E('i'); d.setAttribute('data-d',i); if(i===0)d.className='on'; dots.appendChild(d); });
    var next = E('button','v14-btn v14-next','Next'+ARR_R);
    foot.appendChild(back); foot.appendChild(dots); foot.appendChild(next);
    wrap.appendChild(foot);
    screen.appendChild(wrap);

    var cur=0, N=steps.length;
    function paint(){
      var pages=stage.querySelectorAll('.v14-page');
      for(var i=0;i<pages.length;i++) pages[i].classList.toggle('on', i===cur);
      var ds=dots.querySelectorAll('i');
      for(var k=0;k<ds.length;k++){ ds[k].className = k<cur?'done':(k===cur?'on':''); }
      if(track){ var ts=track.querySelectorAll('.v14-step');
        for(var a=0;a<ts.length;a++){ ts[a].className='v14-step'+(a<cur?' done':(a===cur?' on':'')); }
        var act=track.querySelector('.v14-step.on'); if(act&&act.scrollIntoView){ try{act.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});}catch(e){} }
      }
      back.classList.toggle('hidden', cur===0 && prevModule==null);
      var last = cur===N-1;
      if(last && nextModule==null){ next.style.display='none'; }
      else { next.style.display='';
        var nlbl = (opts&&opts.nextLabel)?opts.nextLabel:('Module '+(nextModule!=null?nextModule:''));
        next.innerHTML = (last?'Next: '+nlbl :'Next')+ARR_R; }
      try{ window.scrollTo&&window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
    }
    next.addEventListener('click', function(){ if(cur<N-1){ cur++; paint(); } else if(nextModule!=null){ goModule(nextModule); } });
    back.addEventListener('click', function(){ if(cur>0){ cur--; paint(); } else if(prevModule!=null){ goModule(prevModule); } });
    dots.addEventListener('click', function(e){ var t=e.target.closest('i'); if(!t)return; cur=+t.getAttribute('data-d'); paint(); });
    if(track){ track.addEventListener('click', function(e){ var t=e.target.closest('.v14-step'); if(!t)return; cur=+t.getAttribute('data-s'); paint(); }); }
    paint();
    return { reset:function(){ cur=0; paint(); } };
  }

  /* ---------------- QUIZ HELPER (delegated) ---------------- */
  function wireQuiz(root){
    root.addEventListener('click', function(e){
      var opt=e.target.closest('.v14-opt'); if(!opt) return;
      var q=opt.closest('.v14-q'); if(!q || q.getAttribute('data-done')) return;
      var correct = opt.getAttribute('data-correct')==='1';
      q.setAttribute('data-done','1');
      q.querySelectorAll('.v14-opt').forEach(function(o){ o.style.pointerEvents='none'; if(o.getAttribute('data-correct')==='1') o.classList.add('right'); });
      if(!correct) opt.classList.add('wrong');
      var fb=q.querySelector('.v14-fb'); if(fb) fb.classList.add('show');
    });
  }

  /* ---------------- MODULE 1 CONTENT ---------------- */
  function module1(){
    var s1 = qs('#s1'); if(!s1) return false;
    if(s1.getAttribute('data-v14')) return true;

    // The user explicitly requested to replace the module 1 code with 5 dynamic image pages.
    // The HTML content is now hardcoded in peptide-101.html and should not be overwritten.
    s1.setAttribute('data-v14','1');
    return true;
  }

  function proteinBlob(){
    return '<svg class="v14-svg v14-float" style="max-width:160px;margin:0 auto;" viewBox="0 0 170 150" xmlns="http://www.w3.org/2000/svg">'
      + '<ellipse cx="85" cy="134" rx="50" ry="9" fill="#05101f" opacity="0.5"/>'
      + '<ellipse cx="84" cy="74" rx="52" ry="42" fill="rgba(59,130,246,.07)" stroke="rgba(127,179,255,.3)" stroke-width="2" stroke-dasharray="5,4"/>'
      + '<path d="M30,86 Q44,34 70,62 Q100,96 118,46 Q132,22 146,54" fill="none" stroke="url(#v14bond)" stroke-width="6" stroke-linecap="round"/>'
      + ['30,86','70,62','100,80','118,46','146,54','86,70'].map(function(p){var xy=p.split(',');return '<g filter="url(#v14sh)"><circle cx="'+xy[0]+'" cy="'+xy[1]+'" r="9" fill="url(#v14bead)"/><ellipse cx="'+(xy[0]-2.5)+'" cy="'+(xy[1]-3)+'" rx="3" ry="2" fill="#fff" opacity="0.55"/></g>';}).join('')
      + '</svg>';
  }
  function sparkDecay(){
    return '<svg viewBox="0 0 180 46" style="width:100%;height:auto;margin-top:11px;" xmlns="http://www.w3.org/2000/svg">'
      + '<path d="M2,6 C50,8 70,40 178,42 L178,44 L2,44 Z" fill="url(#v14dk)"/>'
      + '<path d="M2,6 C50,8 70,40 178,42" fill="none" stroke="#00C4BC" stroke-width="2.5" stroke-linecap="round"/>'
      + '<circle cx="2" cy="6" r="3" fill="#2de0d8"/><text x="150" y="20" fill="#9fb0c2" font-size="9" font-family="Inter,sans-serif">hours</text></svg>';
  }
  function knownCard(name, path, body){
    return '<div class="v14-card"><div class="v14-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+path+'"/></svg></div><h4 style="color:#2de0d8;">'+name+'</h4><p>'+body+'</p></div>';
  }
  function opt(label, correct){ return '<button class="v14-opt" data-correct="'+correct+'"><span class="dot"></span>'+label+'</button>'; }
  function recap(t){ return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>'+t+'</li>'; }

  /* ---------------- PUBLIC API + MODULE LOADER ---------------- */
  function eyebrow(mod, page, total){
    return '<span class="v14-eyebrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Module '+mod+' &middot; Page '+page+' Of '+total+'</span>';
  }
  function ic(path, w){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||2)+'"><path d="'+path+'"/></svg>'; }
  function iconCard(pathOrSvg, title, body, accent){
    var inner = pathOrSvg.charAt(0)==='<' ? pathOrSvg : ic(pathOrSvg);
    return '<div class="v14-card"><div class="v14-ic">'+inner+'</div><h4'+(accent?' style="color:'+accent+';"':'')+'>'+title+'</h4><p>'+body+'</p></div>';
  }
  // Horizontal bar chart. data: [{label, value, color}], maxValue optional, unit optional
  function barChart(data, maxValue, unit){
    var max = maxValue || Math.max.apply(null, data.map(function(d){return d.value;}));
    var rows = data.map(function(d){
      var pct = Math.max(2, Math.round(d.value/max*100));
      return '<div style="margin-bottom:12px;">'
        + '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:#cdd9e6;margin-bottom:5px;"><span style="font-weight:600;color:#eaf2fb;">'+d.label+'</span><span style="color:#9fb0c2;">'+d.value+(unit?(' '+unit):'')+'</span></div>'
        + '<div style="height:14px;border-radius:99px;background:#0b1525;box-shadow:inset 0 1px 3px rgba(0,0,0,.6);overflow:hidden;">'
        + '<div style="height:100%;width:'+pct+'%;border-radius:99px;background:linear-gradient(90deg,'+(d.color||'#3B82F6')+',#9fc4ff);box-shadow:0 0 10px '+(d.color||'#3B82F6')+'66;"></div></div></div>';
    }).join('');
    return '<div class="v14-stage-frame" style="padding:20px;">'+rows+'</div>';
  }
  var API = {
    E:E, qs:qs, go:go, goModule:goModule,
    beadChain:beadChain, proteinBlob:proteinBlob, sparkDecay:sparkDecay,
    knownCard:knownCard, opt:opt, recap:recap, eyebrow:eyebrow, ic:ic,
    iconCard:iconCard, barChart:barChart,
    buildStepper:buildStepper, wireQuiz:wireQuiz, injectDefs:injectDefs, injectCSS:injectCSS
  };
  // module(screenId, modNum, prevMod, nextMod, pagesFn) -> builds when ready; idempotent
  API.module = function(sid, modNum, prev, next, labels, pagesFn, opts){
    function tryBuild(){
      var sc = qs('#'+sid); if(!sc) return false;
      if(sc.getAttribute('data-v14')) return true;
      if(!(window.goTo || (window.P101 && P101.go))) return false;
      injectCSS(); injectDefs();
      var pages = pagesFn(API, eyebrow);
      buildStepper(sc, pages, prev, next, labels, opts);
      wireQuiz(sc);
      sc.setAttribute('data-v14','1');
      return true;
    }
    if(tryBuild()) return;
    var n=0, t=setInterval(function(){ if(tryBuild()||n++>200) clearInterval(t); },50);
  };
  window.P101V14 = API;

  function loadModules(){
    var mods=['m2','m3','m4','m5','m6','m7','m8','m9','m10','m11','m12','m13','m14'];
    mods.forEach(function(m){
      if(D.querySelector('script[data-v14m="'+m+'"]')) return;
      var sc=D.createElement('script'); sc.src='/peptide-101.'+m+'.js'; sc.async=false; sc.setAttribute('data-v14m',m);
      D.body.appendChild(sc);
    });
  }

  /* ---------------- BOOT ---------------- */
  function ready(){ return !!(qs('#s1') && (window.goTo || (window.P101&&P101.go))); }
  function boot(){
    injectCSS(); injectDefs(); loadModules();
    if(!module1()){
      var n=0, t=setInterval(function(){ if(module1()||n++>80) clearInterval(t); },50);
    }
  }
  function start(){
    if(ready()){ setTimeout(boot, 30); return; }
    var n=0, t=setInterval(function(){ if(ready()||n++>120){ clearInterval(t); setTimeout(boot,30); } },50);
  }
  if(D.readyState==='loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
