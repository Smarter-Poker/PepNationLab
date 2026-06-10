/* Peptide 101 - Module 14: Final Quiz And Certificate (screen s15, paginated v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14, D = document;

    var EXAM = [
      {q:'How Many Amino Acids Make Something A Peptide (Not A Protein)?',o:['2 To 50','51 To 100','Exactly 1','Over 1000'],a:0,ex:'2 To 50 Links Is A Peptide. Past About 50 It Becomes A Protein.'},
      {q:'A Peptide Binds To Its Receptor Mainly Because Of Its...',o:['Color','Shape','Price','Smell'],a:1,ex:'Shape Decides Binding. The Key Must Fit The Lock.'},
      {q:'When Two Amino Acids Join, What Small Molecule Leaves?',o:['Oxygen','Salt','Water','Sugar'],a:2,ex:'A Tiny Drop Of Water Is Released When A Peptide Bond Forms.'},
      {q:'Most Research Peptides Are Injected Rather Than Swallowed Because...',o:['They Taste Bad','The Stomach Digests Them','They Are Illegal To Eat','They Are Too Cold'],a:1,ex:'Digestion Breaks Peptide Bonds, So Swallowing Would Destroy Them.'},
      {q:'A Liquid (Reconstituted) Peptide Should Be Stored...',o:['On The Bench','In The Fridge','In Sunlight','In A Hot Car'],a:1,ex:'Once Mixed With Water, Peptides Are Fragile And Belong In The Fridge.'},
      {q:'Add MORE Water To The Same Powder And The Concentration...',o:['Goes Up','Goes Down','Stays Equal','Disappears'],a:1,ex:'The Same Powder Spread Through More Water Is Weaker.'},
      {q:'A Certificate Of Analysis (COA) Confirms...',o:['Identity And Purity','The Shipping Speed','The Brand Logo','The Vial Size Only'],a:0,ex:'A COA Shows Mass-Spec Identity And HPLC Purity For That Batch.'},
      {q:'Which Is TRUE About Research Peptides?',o:['They Are Steroids','They Are FDA-Approved Drugs','They Are For Research Use Only','They Cure Everything'],a:2,ex:'They Are Research-Use-Only Signaling Molecules, Not Approved Drugs.'},
      {q:'A SHORT Half-Life Means A Peptide Is Usually Used...',o:['Once A Year','More Often','Never','Only Frozen'],a:1,ex:'Short Half-Life Clears Fast, So It Is Dosed More Often In Studies.'},
      {q:'Stacking Two Peptides Works Best When They...',o:['Do The Same Job','Hit Different Pathways','Are The Same Color','Are Both Expired'],a:1,ex:'Different Pathways Let Their Effects Add Up (Synergy).'}
    ];
    var PASS = 70, LS = 'p101_progress_v3';
    var picks = {};
    var NS = window.__p101m14 = (window.__p101m14 || {});

    // Inject quiz styles once
    if(!D.getElementById('m14css')){
      var css=''
        + '.m14q{border-radius:16px;padding:18px;margin-bottom:13px;border:1.5px solid transparent;background:linear-gradient(180deg,#0f1f37,#0a1322) padding-box,linear-gradient(155deg,#cdd7e2,#4f5a68,#9eaab7) border-box;box-shadow:0 8px 22px rgba(0,0,0,.4);}'
        + '.m14q .qn{font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#9fb0c2;font-weight:700;margin-bottom:7px;}'
        + '.m14q .qt{font-size:15.5px;color:#eaf1f8;margin-bottom:12px;line-height:1.4;}'
        + '.m14opt{display:flex;align-items:center;gap:11px;width:100%;text-align:left;cursor:pointer;font-size:14px;font-weight:500;color:#e7eef6;padding:12px 15px;margin-bottom:8px;border-radius:11px;border:1px solid transparent;background:linear-gradient(180deg,#15243c,#0c1626) padding-box,linear-gradient(155deg,#cfd9e3,#5a6675,#aeb9c5) border-box;transition:transform .12s,box-shadow .2s;}'
        + '.m14opt:hover{transform:translateY(-1px);}'
        + '.m14opt .dot{width:18px;height:18px;border-radius:50%;border:2px solid #6d7a8a;flex-shrink:0;transition:all .2s;}'
        + '.m14opt[data-sel="1"]{box-shadow:0 0 0 1px #7fb3ff,0 0 14px rgba(94,160,255,.35);}'
        + '.m14opt[data-sel="1"] .dot{border-color:#7fb3ff;background:#7fb3ff;}'
        + '.m14opt[data-state="right"]{color:#9af0d6;background:linear-gradient(180deg,#0f2a25,#0a1c1a) padding-box,linear-gradient(155deg,#a6f0df,#1f8f7d,#7fe0cf) border-box;}'
        + '.m14opt[data-state="right"] .dot{border-color:#22c55e;background:#22c55e;box-shadow:0 0 10px rgba(34,197,94,.6);}'
        + '.m14opt[data-state="wrong"]{color:#f7b4b4;background:linear-gradient(180deg,#2a1414,#1c0e0e) padding-box,linear-gradient(155deg,#f0a6a6,#8f1f1f,#e07f7f) border-box;}'
        + '.m14opt[data-state="wrong"] .dot{border-color:#E53E3E;background:#E53E3E;}'
        + '.m14ex{font-size:12.8px;line-height:1.55;color:#cfe0f5;margin-top:6px;padding:11px 13px;border-radius:10px;background:rgba(0,196,188,.07);border-left:3px solid #00C4BC;display:none;}'
        + '.m14ring .track{fill:none;stroke:#16263f;stroke-width:8;}'
        + '.m14ring .meter{fill:none;stroke-width:8;stroke-linecap:round;transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1s cubic-bezier(.22,.61,.36,1);}'
        + '.m14cert{border:2px solid #2de0d8;border-radius:16px;padding:26px;text-align:center;background:linear-gradient(135deg,rgba(0,196,188,.07),rgba(59,130,246,.07));box-shadow:0 14px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06);}'
        + '.m14cert .nameon{font-family:"Space Grotesk",sans-serif;font-size:24px;font-weight:800;color:#fff;margin:2px 0 6px;}'
        + '.m14namein{width:100%;max-width:320px;margin:0 auto 14px;display:block;padding:11px 14px;border-radius:10px;border:1px solid rgba(150,170,200,.3);background:#0c1626;color:#eaf2fb;font-size:14px;text-align:center;}'
        + '.m14btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;border:1px solid transparent;width:100%;margin-top:10px;}'
        + '.m14btn.prim{color:#0a1322;background:linear-gradient(180deg,#f3f7fb,#cbd5e1 30%,#94a0b0 60%,#e7eef5);border-color:#dbe3ec;box-shadow:0 8px 20px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.9);}'
        + '.m14btn.sec{color:#cdd9e6;background:linear-gradient(180deg,#172742,#0c1626) padding-box,linear-gradient(155deg,#cfd9e3,#5a6675,#aeb9c5) border-box;}'
        + '@media print{.v14-track,.v14-foot,.m14btn,.m14namein,#m14submit{display:none!important;}}'
        ;
      var st=D.createElement('style'); st.id='m14css'; st.textContent=css; D.head.appendChild(st);
    }

    function persist(passed, pct){
      try{ var raw=localStorage.getItem(LS); var s=raw?JSON.parse(raw):{}; s.exam=s.exam||{}; if(passed) s.exam.passed=true; s.exam.best=Math.max(s.exam.best||0,pct); localStorage.setItem(LS, JSON.stringify(s)); }catch(e){}
    }
    function getName(){ try{ var raw=localStorage.getItem(LS); if(raw){ var s=JSON.parse(raw); return (s&&s.name)||''; } }catch(e){} return ''; }

    NS.pick=function(qi,oi){
      var q=D.getElementById('m14q'+qi); if(!q||q.getAttribute('data-locked')) return;
      picks[qi]=oi;
      var opts=q.querySelectorAll('.m14opt');
      for(var i=0;i<opts.length;i++){ opts[i].setAttribute('data-sel', i===oi?'1':'0'); }
    };
    NS.submit=function(){
      var correct=0;
      EXAM.forEach(function(qq,i){
        var q=D.getElementById('m14q'+i); if(!q) return; q.setAttribute('data-locked','1');
        var opts=q.querySelectorAll('.m14opt'); var pick=picks[i];
        for(var oi=0;oi<opts.length;oi++){ opts[oi].style.pointerEvents='none'; opts[oi].removeAttribute('data-sel'); if(oi===qq.a) opts[oi].setAttribute('data-state','right'); else if(oi===pick) opts[oi].setAttribute('data-state','wrong'); }
        if(pick===qq.a) correct++;
        var ex=q.querySelector('.m14ex'); if(ex) ex.style.display='block';
      });
      var pct=Math.round(correct/EXAM.length*100), passed=pct>=PASS;
      persist(passed,pct);
      var sb=D.getElementById('m14submit'); if(sb) sb.style.display='none';
      var col=passed?'#22c55e':'#eab308';
      var circ=2*Math.PI*46, off=circ*(1-pct/100);
      var res=D.getElementById('m14result'); if(!res) return;
      var inner='<div style="text-align:center;">'
        + '<div class="m14ring" style="position:relative;width:120px;height:120px;margin:0 auto 10px;"><svg width="120" height="120" viewBox="0 0 104 104"><circle class="track" cx="52" cy="52" r="46"/><circle class="meter" id="m14meter" cx="52" cy="52" r="46" stroke="'+col+'" stroke-dasharray="'+circ+'" stroke-dashoffset="'+circ+'"/></svg><div style="position:absolute;inset:0;display:grid;place-items:center;font-family:Space Grotesk,sans-serif;font-size:28px;font-weight:800;color:#fff;">'+pct+'%</div></div>'
        + '<h3 style="font-size:20px;margin:0 0 6px;color:#fff;">'+(passed?'You Passed.':'Almost There.')+'</h3>'
        + '<p style="font-size:14px;color:#c4d0dd;max-width:430px;margin:0 auto 8px;">'+(passed?('You Scored '+pct+'% And Earned Your Certificate.'):('You Scored '+pct+'%. You Need '+PASS+'% To Pass. Review The Answers Above, Then Try Again.'))+'</p>'
        + (passed?'':'<button class="m14btn sec" style="max-width:260px;margin:8px auto 0;" onclick="window.__p101m14.retry()">Try Again</button>')
        + '</div>';
      res.innerHTML=inner; res.style.display='block';
      if(passed){ var cert=D.getElementById('m14certwrap'); if(cert){ cert.innerHTML=certHTML(); cert.style.display='block'; var ni=D.getElementById('m14namein'); if(ni){ ni.value=getName(); } } }
      setTimeout(function(){ var mt=D.getElementById('m14meter'); if(mt) mt.style.strokeDashoffset=off; },90);
      try{ res.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){}
    };
    NS.retry=function(){
      picks={};
      EXAM.forEach(function(qq,i){ var q=D.getElementById('m14q'+i); if(!q) return; q.removeAttribute('data-locked'); var opts=q.querySelectorAll('.m14opt'); for(var oi=0;oi<opts.length;oi++){ opts[oi].style.pointerEvents=''; opts[oi].removeAttribute('data-state'); opts[oi].removeAttribute('data-sel'); } var ex=q.querySelector('.m14ex'); if(ex) ex.style.display='none'; });
      var res=D.getElementById('m14result'); if(res){ res.style.display='none'; res.innerHTML=''; }
      var cert=D.getElementById('m14certwrap'); if(cert){ cert.style.display='none'; cert.innerHTML=''; }
      var sb=D.getElementById('m14submit'); if(sb) sb.style.display='inline-flex';
      var top=D.getElementById('m14q0'); if(top){ try{ top.scrollIntoView({behavior:'smooth'}); }catch(e){} }
    };
    NS.setName=function(v){ v=(v||'').replace(/[<>]/g,'').slice(0,40); try{ var raw=localStorage.getItem(LS); var s=raw?JSON.parse(raw):{}; s.name=v; localStorage.setItem(LS,JSON.stringify(s)); }catch(e){} var on=D.getElementById('m14nameon'); if(on) on.textContent=v||'Researcher'; };
    NS.print=function(){ try{ window.print(); }catch(e){} };
    NS.share=function(){
      var txt='I Completed Peptide 101, Foundations Of Peptide Research, On PepNationLab. 13 Modules Plus A Final Knowledge Check Covering Peptide Biology, Mechanisms, Families, Stacking, Reconstitution, And Safety. #PepNationLab #PeptideResearch';
      var done=function(){ var b=D.getElementById('m14sharebtn'); if(b){ var o=b.innerHTML; b.innerHTML='Copied To Clipboard'; setTimeout(function(){ b.innerHTML=o; },1600); } };
      try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(done,function(){}); return; } }catch(e){}
      try{ var ta=D.createElement('textarea'); ta.value=txt; D.body.appendChild(ta); ta.select(); D.execCommand('copy'); D.body.removeChild(ta); done(); }catch(e){}
    };
    NS.restart=function(){ if(window.goTo) window.goTo(0); else if(window.P101&&P101.go) P101.go('s0'); };

    function certHTML(){
      var dstr=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
      return '<div class="m14cert">'
        + '<div style="font-size:11px;letter-spacing:3px;color:#9fb0c2;margin-bottom:10px;">CERTIFICATE OF COMPLETION</div>'
        + '<div style="font-size:11px;letter-spacing:2px;color:#9fb0c2;">AWARDED TO</div>'
        + '<div class="nameon" id="m14nameon">'+(getName()||'Researcher')+'</div>'
        + '<input type="text" id="m14namein" class="m14namein" maxlength="40" placeholder="Enter Your Name" autocomplete="name" oninput="window.__p101m14.setName(this.value)"/>'
        + '<h3 style="font-size:22px;margin:4px 0 2px;color:#fff;">Peptide 101</h3>'
        + '<p style="font-size:14px;color:#9fb0c2;margin:0 0 4px;">Foundations Of Peptide Research</p>'
        + '<div style="width:60px;height:2px;background:linear-gradient(90deg,#2de0d8,#5ea0ff);margin:12px auto;"></div>'
        + '<p style="font-size:13px;color:#cdd9e6;max-width:440px;margin:0 auto;">This Certifies The Completion Of All 13 Modules And The Final Knowledge Check, Covering Peptide Biology, Mechanisms Of Action, Peptide Families, Stacking Frameworks, Reconstitution, Dosing, And Safety And Sourcing.</p>'
        + '<div style="margin-top:14px;font-size:12px;color:#9fb0c2;">Completed: '+dstr+'</div>'
        + '<div style="margin-top:3px;font-size:11px;color:rgba(168,180,192,.6);">PepNationLab, Research Education Division</div>'
        + '<button class="m14btn prim" onclick="window.__p101m14.print()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print Certificate</button>'
        + '<button class="m14btn sec" id="m14sharebtn" onclick="window.__p101m14.share()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy Share Text</button>'
        + '<div style="margin-top:18px;text-align:left;background:rgba(255,255,255,.02);border:1px solid rgba(150,170,200,.18);border-radius:12px;padding:14px 16px;">'
          + '<div style="font-size:13px;font-weight:700;color:#eaf2fb;margin-bottom:8px;">Keep Going</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:8px;">'
          + ['bpc-157|BPC-157','tb-500|TB-500','ipamorelin|Ipamorelin','ghk-cu|GHK-Cu'].map(function(p){var x=p.split('|');return '<a href="/research/compounds/'+x[0]+'" style="font-size:12px;font-weight:700;color:#2de0d8;background:rgba(0,196,188,.12);border:1px solid rgba(0,196,188,.3);border-radius:999px;padding:5px 12px;text-decoration:none;">'+x[1]+'</a>';}).join('')
          + '<a href="/research/a-z" style="font-size:12px;font-weight:700;color:#7fb3ff;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3);border-radius:999px;padding:5px 12px;text-decoration:none;">Browse The Full A-Z Library</a>'
          + '</div></div>'
        + '<button class="m14btn sec" onclick="window.__p101m14.restart()" style="margin-top:14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>Restart Course</button>'
        + '</div>';
    }

    var labels = ['The Final Check','Quiz And Certificate'];

    var P1 = H.eyebrow(14,1,2)
      + '<h1 class="v14-h">Final Quiz And Certificate</h1>'
      + '<p class="v14-lead">This is the last step. Ten quick questions pull together everything from the thirteen modules. Score 70 percent or higher to earn your certificate. You can retry as many times as you like.</p>'
      + '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 170" xmlns="http://www.w3.org/2000/svg">'
        + '<ellipse cx="310" cy="150" rx="170" ry="11" fill="#05101f" opacity="0.5"/>'
        + '<g class="v14-float" filter="url(#v14sh)"><circle cx="310" cy="78" r="50" fill="url(#v14beadT)"/></g>'
        + '<path d="M288 78l14 14 28-30" fill="none" stroke="#04201d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<path d="M150 60l5 14 14 5-14 5-5 14-5-14-14-5 14-5z" fill="#7fb3ff" opacity="0.85"/>'
        + '<path d="M470 60l5 14 14 5-14 5-5 14-5-14-14-5 14-5z" fill="#2de0d8" opacity="0.85"/>'
        + '<text x="310" y="150" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Pass The Check, Earn Your Certificate</text>'
        + '</svg></div>'
      + '<div class="v14-cards c3">'
        + H.iconCard('M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11','10 Questions','One quick question per topic, drawn from all thirteen modules.','#2de0d8')
        + H.iconCard('M12 8v4l3 2M12 3a9 9 0 1 0 9 9','70% To Pass','Get at least seven right. Retry as many times as you need.','#7fb3ff')
        + H.iconCard('M12 15l-2 6 2-1 2 1-2-6M12 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z','Your Certificate','Pass and your personalized certificate appears, ready to print.','#a78bfa')
      + '</div>';

    var quiz = EXAM.map(function(qq,i){
      var opts=qq.o.map(function(o,oi){ return '<button class="m14opt" onclick="window.__p101m14.pick('+i+','+oi+')"><span class="dot"></span>'+o+'</button>'; }).join('');
      return '<div class="m14q" id="m14q'+i+'"><div class="qn">Question '+(i+1)+' Of '+EXAM.length+'</div><div class="qt">'+qq.q+'</div>'+opts+'<div class="m14ex">'+qq.ex+'</div></div>';
    }).join('');

    var P2 = H.eyebrow(14,2,2)
      + '<h1 class="v14-h">Final Knowledge Check</h1>'
      + '<p class="v14-lead">Pick one answer for each question, then submit. Your score and certificate appear below.</p>'
      + quiz
      + '<button class="m14btn prim" id="m14submit" style="max-width:280px;margin:6px auto 0;" onclick="window.__p101m14.submit()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>Submit Answers</button>'
      + '<div id="m14result" style="display:none;margin-top:18px;"></div>'
      + '<div id="m14certwrap" style="display:none;margin-top:18px;"></div>';

    // s15 is the assessment screen (injected by app.js). prev -> Module 13 (s14 = goTo 14). next null = end of course.
    H.module('s15', 14, 14, null, labels, function(){ return [P1, P2]; });
  }
  start();
})();
