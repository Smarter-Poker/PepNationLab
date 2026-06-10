/* =====================================================================
   PEPTIDE 101 v10 - AI TUTOR ("Ask A Question") ON EVERY MODULE
   Loaded last. Injects a contextual "Ask A Question Before Moving On" box
   at the bottom of every content module (above the Next/Back nav). Sends the
   learner's question + module topic to /api/peptide-101/ask (Gemini,
   research-education guardrails) and renders the answer inline, plus:
     - AI-generated follow-up question chips (keep the conversation going)
     - Voice input (speech-to-text) where the browser supports it
     - Read-aloud of the answer (text-to-speech) where supported
   Idempotent; preserves each screen's nav-ctrl so completion is untouched.
   ===================================================================== */
(function(){
  function qs(s,r){return (r||document).querySelector(s);}
  function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstChild;}
  function ic(d,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="'+(w||16)+'" height="'+(w||16)+'" style="flex-shrink:0;">'+d+'</svg>';}
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var TTS = (typeof window.speechSynthesis !== 'undefined') && (typeof window.SpeechSynthesisUtterance !== 'undefined');
  var MIC_ICON='<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>';
  var SPK_ICON='<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>';

  var TOPICS={
    s1:'What A Peptide Is (The Basics)',
    s2:'What Peptides Do In The Body (Messengers And Half-Life)',
    s3:'How Peptides Work (The Lock And Key / Receptors)',
    s4:'What Peptides Are Studied For (Research Use Cases)',
    s5:'Handling And Storage Of Peptides',
    s6:'Peptide Families And Categories',
    s7:'Stacking And Research Protocols',
    s8:'Reconstitution (Mixing Peptides With Water, Concentration Math)',
    s9:'Dosing Reference (Amounts, Frequency, Half-Life, Routes)',
    s11:'What Peptides Are NOT (Vs Steroids, Not Medicines)',
    s12:'Why Peptides Are Injected (Digestion And Sub-Q)',
    s13:'Safety, Purity And Sourcing (COA, HPLC, Red Flags)',
    s14:'Legality And Research-Use-Only Status'
  };
  var SUGGEST={
    s1:['What Is The Difference Between A Peptide And A Protein?','Why Do Peptides Leave The Body So Fast?'],
    s2:['What Does Half-Life Actually Mean?','How Is A Peptide Different From A Vitamin?'],
    s3:['What Is A Receptor?','What Is The Difference Between An Agonist And Antagonist?'],
    s4:['Which Peptides Are Studied For Recovery?','What Does "Studied For" Really Mean?'],
    s5:['Why Does Light Damage Peptides?','What Is BAC Water?'],
    s6:['What Is The Growth Hormone Axis?','How Are Families Decided?'],
    s7:['Why Would Researchers Combine Two Peptides?','What Is A Protocol?'],
    s8:['What Does mcg/mL Mean?','Why Add Water Slowly?'],
    s9:['What Is The Difference Between mcg And mg?','Why Do Some Peptides Get Used More Often?'],
    s11:['How Are Peptides Different From Steroids?','Are Any Research Peptides FDA-Approved?'],
    s12:['Why Would The Stomach Destroy A Peptide?','What Does Sub-Q Mean?'],
    s13:['What Is A COA?','What Does HPLC Purity Tell Me?'],
    s14:['What Does "Research Use Only" Mean?','Why Are These Not Approved Medicines?']
  };

  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function renderAnswer(md){
    var lines=String(md).split(/\r?\n/), out=[], list=[];
    function flush(){ if(list.length){ out.push('<ul style="margin:6px 0;padding-left:18px;">'+list.join('')+'</ul>'); list=[]; } }
    function inline(t){ return esc(t).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>'); }
    lines.forEach(function(ln){
      var t=ln.trim();
      if(!t){ flush(); return; }
      var m=t.match(/^[-*]\s+(.*)/);
      if(m){ list.push('<li style="margin:2px 0;">'+inline(m[1])+'</li>'); }
      else { flush(); out.push('<p style="margin:6px 0;">'+inline(t)+'</p>'); }
    });
    flush();
    return out.join('');
  }
  function msg(t){ return '<p style="color:var(--muted);font-size:13px;margin:0;">'+t+'</p>'; }

  /* ---------- VOICE INPUT (speech-to-text) ---------- */
  window.P101mic=function(id){
    if(!Rec) return;
    var ta=qs('#askq-'+id), mic=qs('#askmic-'+id);
    if(window.__p101rec){ try{ window.__p101rec.stop(); }catch(e){} return; }
    var r; try{ r=new Rec(); }catch(e){ return; }
    window.__p101rec=r; r.lang='en-US'; r.interimResults=false; r.maxAlternatives=1;
    if(mic){ mic.setAttribute('aria-pressed','true'); mic.style.borderColor='var(--teal)'; mic.style.color='var(--teal)'; }
    r.onresult=function(e){ var t=''; for(var i=0;i<e.results.length;i++){ t+=e.results[i][0].transcript; } if(ta){ ta.value=(ta.value?ta.value.trim()+' ':'')+String(t).trim(); ta.focus(); } };
    r.onerror=function(){};
    r.onend=function(){ window.__p101rec=null; if(mic){ mic.setAttribute('aria-pressed','false'); mic.style.borderColor=''; mic.style.color=''; } };
    try{ r.start(); }catch(e){ window.__p101rec=null; }
  };

  /* ---------- READ ALOUD (text-to-speech) ---------- */
  window.P101read=function(id){
    if(!TTS) return;
    var synth=window.speechSynthesis;
    var wrap=qs('#aska-'+id), ansEl=wrap?wrap.querySelector('.ai-ans'):null; if(!ansEl) return;
    var btn=qs('#askread-'+id);
    if(synth.speaking||synth.pending){ try{synth.cancel();}catch(e){} if(btn) btn.setAttribute('aria-pressed','false'); return; }
    var u; try{ u=new window.SpeechSynthesisUtterance(String(ansEl.textContent||'').trim()); }catch(e){ return; }
    u.lang='en-US'; u.rate=1;
    u.onend=function(){ if(btn) btn.setAttribute('aria-pressed','false'); };
    u.onerror=function(){ if(btn) btn.setAttribute('aria-pressed','false'); };
    if(btn) btn.setAttribute('aria-pressed','true');
    try{ synth.cancel(); synth.speak(u); }catch(e){ if(btn) btn.setAttribute('aria-pressed','false'); }
  };

  window.P101askSuggest=function(id,text){ var ta=qs('#askq-'+id); if(ta){ ta.value=text; ta.focus(); } window.P101ask(id); };
  window.P101ask=function(id){
    var ta=qs('#askq-'+id), ans=qs('#aska-'+id), btn=qs('#askb-'+id);
    if(!ta||!ans||!btn) return;
    var q=(ta.value||'').trim();
    ans.style.display='block';
    if(q.length<3){ ans.innerHTML=msg('Please Type A Question First.'); return; }
    var orig=btn.innerHTML; btn.disabled=true; btn.innerHTML='Thinking...';
    ans.innerHTML='<p style="color:var(--muted);font-size:13px;margin:0;display:flex;align-items:center;gap:8px;">'+ic('<path d="M21 12a9 9 0 1 1-6.2-8.5"/>',16)+'Thinking...</p>';
    fetch('/api/peptide-101/ask',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({question:q,module:TOPICS[id]||'peptide basics'})})
      .then(function(r){ return r.json().then(function(j){return {s:r.status,j:j};},function(){return {s:r.status,j:{}};}); })
      .then(function(o){
        btn.disabled=false; btn.innerHTML=orig;
        if(o.j && o.j.answer){
          var html='<div class="ai-ans" style="font-size:13px;color:var(--silver);line-height:1.55;">'+renderAnswer(o.j.answer)+'</div>';
          var controls='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;">';
          if(TTS){ controls+='<button type="button" class="calc-preset" id="askread-'+id+'" aria-pressed="false" aria-label="Read The Answer Aloud" onclick="P101read(\''+id+'\')" style="font-size:12px;display:inline-flex;align-items:center;gap:5px;">'+ic(SPK_ICON,14)+'Read Aloud</button>'; }
          controls+='</div>';
          var fups=(o.j.followups&&o.j.followups.length)?
            '<div style="margin-top:12px;"><div style="font-size:11px;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;gap:5px;">'+ic('<path d="M5 12h14M12 5l7 7-7 7"/>',13)+'Keep Going - Ask A Follow-Up:</div><div style="display:flex;gap:6px;flex-wrap:wrap;">'+
              o.j.followups.map(function(f){return '<button type="button" class="calc-preset" style="font-size:12px;" data-q="'+esc(f)+'" onclick="P101askSuggest(\''+id+'\',this.dataset.q)">'+esc(f)+'</button>';}).join('')+'</div></div>':'';
          ans.innerHTML=html+controls+fups+
            '<p style="font-size:11px;color:var(--muted);margin:10px 0 0;border-top:1px solid var(--border);padding-top:8px;">AI Tutor - Research Education Only. Not Medical Or Dosing Advice.</p>';
          return;
        }
        ans.innerHTML=msg((o.j&&o.j.error)?o.j.error:'Something Went Wrong. Please Try Again.');
      })
      .catch(function(){ btn.disabled=false; btn.innerHTML=orig; ans.innerHTML=msg('Network Error. Please Try Again.'); });
  };

  function askCard(id){
    var sug=(SUGGEST[id]||[]).map(function(t){return '<button type="button" class="calc-preset" style="font-size:12px;" onclick="P101askSuggest(\''+id+'\',this.textContent)">'+t+'</button>';}).join('');
    var micBtn = Rec ? '<button type="button" class="calc-preset" id="askmic-'+id+'" aria-pressed="false" aria-label="Ask By Voice" title="Ask By Voice" onclick="P101mic(\''+id+'\')" style="font-size:12px;display:inline-flex;align-items:center;gap:5px;">'+ic(MIC_ICON,14)+'Speak</button>' : '';
    return '<div class="card ask-card" id="ask-'+id+'" style="border:1px solid rgba(0,196,188,.3);background:linear-gradient(180deg,rgba(0,196,188,.05),transparent);">'+
      '<div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;"><div style="min-width:34px;height:34px;border-radius:9px;background:rgba(0,196,188,.14);display:flex;align-items:center;justify-content:center;color:var(--teal);">'+ic('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M9.5 9h5M9.5 12h3"/>')+'</div><h3 style="font-size:16px;margin:0;">Ask A Question Before Moving On</h3></div>'+
      '<p style="font-size:13px;color:var(--silver);margin:0 0 10px;">Curious About Anything You Just Read? Ask The AI Tutor In Plain English'+(Rec?' Or By Voice':'')+' And Get A Beginner-Friendly Answer.</p>'+
      (sug?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">'+sug+'</div>':'')+
      '<textarea id="askq-'+id+'" class="calc-input" rows="2" placeholder="Type Your Question Here..." aria-label="Ask A Question" style="resize:vertical;min-height:46px;margin-bottom:10px;" onkeydown="if((event.metaKey||event.ctrlKey)&&event.key===&#39;Enter&#39;)P101ask(\''+id+'\')"></textarea>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'+
        '<button type="button" class="btn btn-primary" id="askb-'+id+'" onclick="P101ask(\''+id+'\')" style="font-size:13px;">'+ic('<path d="M5 12h14M12 5l7 7-7 7"/>',16)+'Ask The AI Tutor</button>'+micBtn+
      '</div>'+
      '<div id="aska-'+id+'" style="display:none;margin-top:12px;padding:12px;background:var(--surface2);border-radius:10px;"></div>'+
    '</div>';
  }
  function inject(id){
    var sc=document.getElementById(id); if(!sc || qs('#ask-'+id,sc)) return;
    var nav=sc.querySelector('.nav-ctrl');
    var node=el(askCard(id));
    if(nav) sc.insertBefore(node, nav); else sc.appendChild(node);
  }

  var IDS=['s1','s2','s3','s4','s5','s6','s7','s8','s9','s11','s12','s13','s14'];
  function ready(){ return !!(document.getElementById('s1') && document.getElementById('s14')); }
  function init(){
    if(window.__p101v10) return; window.__p101v10=1;
    IDS.forEach(function(id){ try{ inject(id); }catch(e){} });
  }
  function boot(){ if(ready()){init();return;} var n=0,t=setInterval(function(){ if(ready()||n++>160){clearInterval(t);init();} },40); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,160);});
  else setTimeout(boot,160);
})();
