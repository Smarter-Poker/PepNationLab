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

  /* ---------------- SHARED SVG DEFS ---------------- */
  var DEFS = '<defs>'
    + '<radialGradient id="v14bead" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="#d8ecff"/><stop offset="45%" stop-color="#4f93e6"/><stop offset="100%" stop-color="#13315e"/></radialGradient>'
    + '<radialGradient id="v14beadT" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="#c9fff6"/><stop offset="45%" stop-color="#15b8ad"/><stop offset="100%" stop-color="#06403c"/></radialGradient>'
    + '<linearGradient id="v14bond" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#9fc4ff"/><stop offset="100%" stop-color="#2a4c7d"/></linearGradient>'
    + '<filter id="v14sh" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity="0.5"/></filter>'
    + '<filter id="v14glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '</defs>';

  function beadChain(n, teal){
    // a glossy peptide chain of n beads with bonds, 3D depth
    var W=620, H=200, cx=70, gap=(W-140)/(n-1), y=H/2, r=26;
    var s='<svg class="v14-svg" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">'+DEFS;
    s+='<ellipse cx="'+(W/2)+'" cy="'+(H-18)+'" rx="'+(W*0.38)+'" ry="13" fill="#05101f" opacity="0.55"/>';
    var g = teal?'url(#v14beadT)':'url(#v14bead)';
    for(var i=0;i<n-1;i++){ var x1=cx+gap*i, x2=cx+gap*(i+1); s+='<line x1="'+x1+'" y1="'+y+'" x2="'+x2+'" y2="'+y+'" stroke="url(#v14bond)" stroke-width="9" stroke-linecap="round" opacity="0.9"/>'; }
    s+='<g class="v14-float">';
    for(var j=0;j<n;j++){ var x=cx+gap*j; s+='<g filter="url(#v14sh)"><circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+g+'"/><ellipse cx="'+(x-7)+'" cy="'+(y-9)+'" rx="8" ry="5" fill="#ffffff" opacity="0.55"/></g>'; }
    s+='</g></svg>';
    return s;
  }

  /* ---------------- STEPPER FRAMEWORK ---------------- */
  function buildStepper(screen, steps, prevModule, nextModule){
    screen.innerHTML='';
    var wrap = E('div','v14');
    var stage = E('div','v14-stage');
    wrap.appendChild(stage);
    steps.forEach(function(html,i){ var p=E('div','v14-page'+(i===0?' on':''),html); p.setAttribute('data-step',i); stage.appendChild(p); });

    var foot = E('div','v14-foot');
    var back = E('button','v14-btn v14-back hidden','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Back');
    var dots = E('div','v14-dots');
    steps.forEach(function(_,i){ var d=E('i'); d.setAttribute('data-d',i); if(i===0)d.className='on'; dots.appendChild(d); });
    var next = E('button','v14-btn v14-next','Next<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>');
    foot.appendChild(back); foot.appendChild(dots); foot.appendChild(next);
    wrap.appendChild(foot);
    screen.appendChild(wrap);

    var cur=0, N=steps.length;
    function paint(){
      var pages=stage.querySelectorAll('.v14-page');
      for(var i=0;i<pages.length;i++) pages[i].classList.toggle('on', i===cur);
      var ds=dots.querySelectorAll('i');
      for(var k=0;k<ds.length;k++){ ds[k].className = k<cur?'done':(k===cur?'on':''); }
      back.classList.toggle('hidden', cur===0 && prevModule==null);
      var last = cur===N-1;
      next.innerHTML = (last?'Next: Module '+ (nextModule!=null?nextModule:'') :'Next')+'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
      try{ var app=qs('#app'); (app||window).scrollTo?window.scrollTo({top:0,behavior:'smooth'}):0; }catch(e){}
    }
    next.addEventListener('click', function(){
      if(cur<N-1){ cur++; paint(); }
      else if(nextModule!=null){ goModule(nextModule); }
    });
    back.addEventListener('click', function(){
      if(cur>0){ cur--; paint(); }
      else if(prevModule!=null){ goModule(prevModule); }
    });
    dots.addEventListener('click', function(e){ var t=e.target.closest('i'); if(!t)return; var i=+t.getAttribute('data-d'); if(i<=cur+0){ cur=i; paint(); } });
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

    var P1 = ''
      + '<span class="v14-eyebrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/></svg>Module 1 &middot; Page 1 Of 5</span>'
      + '<h1 class="v14-h">What Exactly Is A Peptide?</h1>'
      + '<p class="v14-lead">A peptide is a <b>short chain of amino acids</b>. Picture amino acids as Lego bricks &mdash; a peptide is what you get when you snap <b>2 to 50</b> of them together in a specific order.</p>'
      + '<div class="v14-stage-frame">'+beadChain(6,false)+'</div>'
      + '<div class="v14-bridge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg><p><b>Why you’re here:</b> Your body already makes peptides on its own. In this course you’ll learn about <b>research peptides</b> &mdash; lab-made versions scientists study to understand how the body’s signals work.</p></div>';

    var P2 = ''
      + '<span class="v14-eyebrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>Module 1 &middot; Page 2 Of 5</span>'
      + '<h1 class="v14-h">Peptide Or Protein? It’s About Size</h1>'
      + '<p class="v14-lead">Same building blocks &mdash; the only difference is <b>how long the chain is</b>.</p>'
      + '<div class="v14-stage-frame" style="padding:20px;">'
        + '<div class="v14-scale">'
          + '<div class="pep"><div class="big">2&ndash;50</div><div class="cap">Amino Acids</div><div style="margin:12px 0 6px;">'+beadChain(4,true).replace('viewBox="0 0 620 200"','viewBox="0 0 360 120"').replace(/r="26"/g,'r="17"')+'</div><div class="nm" style="color:#2de0d8;">Peptide</div></div>'
          + '<div class="pro"><div class="big">51+</div><div class="cap">Amino Acids</div><div style="margin:12px 0 6px;display:flex;justify-content:center;">'+proteinBlob()+'</div><div class="nm" style="color:#7fb3ff;">Protein</div></div>'
        + '</div>'
      + '</div>'
      + '<p class="v14-lead" style="font-size:14px;color:#aebccb;margin:0;">A peptide is small and nimble, so it moves around the body easily. Cross 50 links and it folds into a big 3-D shape &mdash; now it’s a protein (like the ones in muscle or egg whites).</p>';

    var P3 = ''
      + '<span class="v14-eyebrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>Module 1 &middot; Page 3 Of 5</span>'
      + '<h1 class="v14-h">Three Things That Make Peptides Special</h1>'
      + '<p class="v14-lead">You don’t need the chemistry &mdash; just these three ideas.</p>'
      + '<div class="v14-cards c3">'
        + '<div class="v14-card"><div class="v14-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><h4>They Send Messages</h4><p>A peptide is like a tiny text message for your cells. It tells one exact cell what to do &mdash; and nothing else gets the memo.</p></div>'
        + '<div class="v14-card"><div class="v14-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><h4>They Don’t Last Long</h4><p>Your body clears them in hours, not days. That’s a good thing &mdash; it keeps your body firmly in control.</p>'+sparkDecay()+'</div>'
        + '<div class="v14-card"><div class="v14-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 11.08V8l-6-4-6 4v3.08"/><path d="M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M12 4v17"/></svg></div><h4>Your Body Makes Them</h4><p>Right now your body is building peptides of its own. Scientists often just copy the ones it already knows how to use.</p></div>'
      + '</div>';

    var P4 = ''
      + '<span class="v14-eyebrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>Module 1 &middot; Page 4 Of 5</span>'
      + '<h1 class="v14-h">Peptides You Already Know</h1>'
      + '<p class="v14-lead">These are all peptides your body uses every day &mdash; you’ve heard of them before.</p>'
      + '<div class="v14-cards c3">'
        + knownCard('Insulin','M12 2v6M12 22v-4M4.9 4.9l3 3M19.1 4.9l-3 3','Controls your blood sugar. It tells your body to lower blood sugar after you eat.')
        + knownCard('Oxytocin','M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z','The bonding peptide. Your body releases it during hugs and time with people you love.')
        + knownCard('Endorphins','M13 2 3 14h9l-1 8 10-12h-9l1-8z','Your feel-good chemicals. Released when you laugh or exercise, to help you feel good.')
      + '</div>'
      + '<div class="v14-bridge" style="box-shadow:0 8px 22px rgba(0,0,0,.45),inset 4px 0 0 #E53E3E;"><svg viewBox="0 0 24 24" fill="none" stroke="#E53E3E" stroke-width="2"><path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/></svg><p><b>Research note:</b> The peptides in this course are for laboratory research only. They are not medicines. Scientists use them to learn how things work.</p></div>';

    var P5 = ''
      + '<span class="v14-eyebrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Module 1 &middot; Page 5 Of 5</span>'
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you’re ready for Module 2.</p>'
      + '<div class="v14-q" id="v14q1"><div class="qn">Question 1 Of 2</div><div class="qt">A peptide is a short chain of what?</div>'
        + opt('Amino Acids',1) + opt('Sugar Molecules',0) + opt('Strands Of DNA',0)
        + '<div class="v14-fb">Correct &mdash; amino acids are the building blocks, snapped together in a chain.</div></div>'
      + '<div class="v14-q" id="v14q2"><div class="qn">Question 2 Of 2</div><div class="qt">What turns a peptide into a protein?</div>'
        + opt('It changes color',0) + opt('The chain grows past 50 amino acids',1) + opt('It leaves the body',0)
        + '<div class="v14-fb">Right &mdash; past about 50 links the chain folds into a bigger 3-D shape and becomes a protein.</div></div>'
      + '<div class="v14-recap"><h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/></svg>Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + recap('A peptide is a short chain of amino acids (2 to 50).')
        + recap('Past 50 links it becomes a protein.')
        + recap('Peptides send precise messages, don’t last long, and your body already makes them.')
        + recap('This course is about research peptides — lab-made versions, for study only.')
      + '</ul></div>';

    var stepper = buildStepper(s1, [P1,P2,P3,P4,P5], 0, 2);
    wireQuiz(s1);
    s1.setAttribute('data-v14','1');
    return true;
  }

  function proteinBlob(){
    return '<svg class="v14-svg v14-float" style="max-width:150px;" viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg">'+DEFS
      + '<ellipse cx="80" cy="106" rx="46" ry="9" fill="#05101f" opacity="0.5"/>'
      + '<path d="M30,70 Q40,28 64,52 Q92,80 110,40 Q124,18 138,46" fill="none" stroke="url(#v14bond)" stroke-width="7" stroke-linecap="round"/>'
      + '<ellipse cx="78" cy="58" rx="44" ry="34" fill="none" stroke="rgba(127,179,255,.28)" stroke-width="2" stroke-dasharray="5,4"/>'
      + ['30,70','64,52','110,40','138,46','86,66'].map(function(p){var xy=p.split(',');return '<circle cx="'+xy[0]+'" cy="'+xy[1]+'" r="8" fill="url(#v14bead)" filter="url(#v14sh)"/>';}).join('')
      + '</svg>';
  }
  function sparkDecay(){
    return '<svg viewBox="0 0 180 46" style="width:100%;height:auto;margin-top:11px;" xmlns="http://www.w3.org/2000/svg">'
      + '<defs><linearGradient id="v14dk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,196,188,.4)"/><stop offset="100%" stop-color="rgba(0,196,188,0)"/></linearGradient></defs>'
      + '<path d="M2,6 C50,8 70,40 178,42 L178,44 L2,44 Z" fill="url(#v14dk)"/>'
      + '<path d="M2,6 C50,8 70,40 178,42" fill="none" stroke="#00C4BC" stroke-width="2.5" stroke-linecap="round"/>'
      + '<circle cx="2" cy="6" r="3" fill="#2de0d8"/><text x="150" y="20" fill="#9fb0c2" font-size="9" font-family="Inter,sans-serif">hours</text></svg>';
  }
  function knownCard(name, path, body){
    return '<div class="v14-card"><div class="v14-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+path+'"/></svg></div><h4 style="color:#2de0d8;">'+name+'</h4><p>'+body+'</p></div>';
  }
  function opt(label, correct){ return '<button class="v14-opt" data-correct="'+correct+'"><span class="dot"></span>'+label+'</button>'; }
  function recap(t){ return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>'+t+'</li>'; }

  /* ---------------- BOOT ---------------- */
  function ready(){ return !!(qs('#s1') && (window.goTo || (window.P101&&P101.go))); }
  function boot(){
    injectCSS();
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
