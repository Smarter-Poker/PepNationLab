/* =====================================================================
   PEPTIDE 101 v6 - PRACTICAL AIDS
   Loaded after v3/v4/v5. Adds: an interactive insulin-syringe fill visual
   to Module 8 (paired with the reconstitution math), a link to the live
   Reconstitution & Shelf-Life tracker in Module 5, and a printable
   one-page cheat sheet on the completion screen. Idempotent.
   ===================================================================== */
(function(){
  function qs(s,r){return (r||document).querySelector(s);}
  function el(h){var d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild;}
  function ic(d,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="'+(w||15)+'" height="'+(w||15)+'" style="flex-shrink:0;">'+d+'</svg>';}
  var syrDose=250;

  /* ---------- SYRINGE FILL VISUAL (Module 8) ---------- */
  function conc(){ var i=qs('#calcConc'); var v=i?parseFloat(i.value):1000; return (v&&v>0)?v:1000; }
  function syrRender(){
    var wrap=qs('#syrViz'); if(!wrap) return;
    var c=conc(); var vol=syrDose/c; var units=vol*100; var frac=Math.max(0,Math.min(1,units/100));
    var barX=18, barW=250, fillW=Math.round(barW*frac);
    var ticks='';
    for(var u=0;u<=100;u+=10){ var x=barX+(barW*u/100); ticks+='<line x1="'+x+'" y1="20" x2="'+x+'" y2="'+(u%50===0?40:32)+'" stroke="#5a6675" stroke-width="1"/>'+(u%50===0?'<text x="'+x+'" y="54" fill="#A8B4C0" font-size="9" text-anchor="middle" font-family="Inter,sans-serif">'+u+'</text>':''); }
    wrap.innerHTML=
      '<svg width="100%" viewBox="0 0 300 76" aria-label="Insulin syringe filled to '+units.toFixed(0)+' units">'+
      '<rect x="'+barX+'" y="20" width="'+barW+'" height="16" rx="3" fill="#0F1923" stroke="#5a6675" stroke-width="1.5"/>'+
      '<rect x="'+barX+'" y="20" width="'+fillW+'" height="16" rx="3" fill="url(#syrFill)"/>'+
      '<defs><linearGradient id="syrFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#00C4BC"/><stop offset="100%" stop-color="#3B82F6"/></linearGradient></defs>'+
      '<rect x="'+(barX+barW)+'" y="23" width="10" height="10" rx="2" fill="#162230" stroke="#5a6675" stroke-width="1"/>'+
      '<line x1="'+(barX+barW+10)+'" y1="28" x2="296" y2="28" stroke="#8A9BB0" stroke-width="1.5"/>'+
      ticks+'</svg>';
    var read=qs('#syrRead'); if(read) read.innerHTML='Draw To <strong style="color:var(--teal);">'+units.toFixed(0)+' Units</strong> ('+vol.toFixed(3)+' mL) For A '+syrDose+' mcg Dose At '+c+' mcg/mL.';
    var chips=qs('#syrChips'); if(chips){ Array.prototype.forEach.call(chips.children,function(b){ b.classList.toggle('active', parseInt(b.dataset.dose,10)===syrDose); }); }
  }
  function buildSyringe(){
    var s8=qs('#s8'); if(!s8 || qs('#syrCard')) return;
    var doses=[100,200,250,300,500];
    var chips=doses.map(function(dz){return '<button class="calc-preset'+(dz===syrDose?' active':'')+'" data-dose="'+dz+'" onclick="P101v6.syr('+dz+')" aria-label="Show '+dz+' microgram draw">'+dz+' mcg</button>';}).join('');
    var card=el('<div class="card" id="syrCard"><h3 style="font-size:15px;margin-bottom:6px;">See It On The Syringe</h3>'+
      '<p style="font-size:13px;color:var(--muted);margin-bottom:10px;">Pick A Dose To See Exactly How Far To Pull The Plunger On A 100-Unit Insulin Syringe, Using The Concentration From The Calculator Above.</p>'+
      '<div id="syrChips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;" role="group" aria-label="Select Dose">'+chips+'</div>'+
      '<div id="syrViz" aria-live="polite"></div>'+
      '<p id="syrRead" style="font-size:13px;margin-top:8px;"></p>'+
      '<div class="callout callout-red" style="margin-top:10px;"><strong style="color:var(--red);">Research Use Only:</strong> A Visual Teaching Aid. Not Instructions For Human Dosing.</div></div>');
    var nc=s8.querySelector('.nav-ctrl'); if(nc) s8.insertBefore(card,nc); else s8.appendChild(card);
    var ci=qs('#calcConc'); if(ci) ci.addEventListener('input',syrRender);
    syrRender();
  }

  /* ---------- SHELF-LIFE TRACKER LINK (Module 5) ---------- */
  function buildShelfLink(){
    var s5=qs('#s5'); if(!s5 || qs('#shelfLink')) return;
    var card=el('<div class="card" id="shelfLink"><div style="display:flex;align-items:flex-start;gap:12px;">'+
      '<div style="min-width:40px;height:40px;border-radius:10px;background:rgba(0,196,188,0.12);display:flex;align-items:center;justify-content:center;">'+ic('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',20).replace('stroke="currentColor"','stroke="var(--teal)"')+'</div>'+
      '<div style="flex:1;"><strong style="font-size:14px;">Track Your Reconstituted Vials</strong>'+
      '<p style="font-size:13px;color:var(--muted);margin:4px 0 10px;">Once You Add Water, A Peptide Has A Limited Window. Log The Date And Let The Tracker Tell You The Discard Date For Each Vial.</p>'+
      '<a class="btn btn-secondary" href="/shelf-life" style="font-size:13px;">Open The Shelf-Life Tracker'+ic('<path d="M5 12h14M12 5l7 7-7 7"/>',16)+'</a></div></div></div>');
    var nc=s5.querySelector('.nav-ctrl'); if(nc) s5.insertBefore(card,nc); else s5.appendChild(card);
  }

  /* ---------- PRINTABLE CHEAT SHEET (completion) ---------- */
  function cheatHTML(){
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Peptide 101 Cheat Sheet</title>'+
    '<style>body{font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#0F1923;max-width:760px;margin:24px auto;padding:0 20px;line-height:1.5;}h1{font-size:22px;margin:0 0 2px;}h2{font-size:14px;margin:18px 0 6px;color:#0a7d77;border-bottom:1px solid #cdd6df;padding-bottom:3px;}.sub{color:#5a6675;font-size:12px;margin-bottom:8px;}ul{margin:6px 0;padding-left:18px;}li{margin:2px 0;font-size:13px;}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px;}th,td{border:1px solid #cdd6df;padding:4px 6px;text-align:left;}.note{margin-top:18px;font-size:11px;color:#b13;border:1px solid #f0c2c2;background:#fdf2f2;padding:8px;border-radius:6px;}@media print{body{margin:0;}}</style></head><body>'+
    '<h1>Peptide 101 - Cheat Sheet</h1><div class="sub">Foundations Of Peptide Research - PepNationLab</div>'+
    '<h2>The Basics</h2><ul><li><b>Peptide:</b> A Short Chain Of 2-50 Amino Acids. Past 50 It Becomes A Protein.</li><li><b>How They Work:</b> Lock And Key - A Peptide Only Acts When Its Shape Fits A Receptor.</li><li><b>Why Injected:</b> The Stomach Digests Peptides, So Most Are Given Sub-Q To Survive.</li></ul>'+
    '<h2>Reconstitution Formula</h2><ul><li>(Vial mg x 1000) / Target Concentration (mcg/mL) = mL Of BAC Water To Add.</li><li>Units On A 100-Unit Syringe = (Dose mcg / Concentration mcg/mL) x 100.</li><li>Add Water Slowly Down The Side, Swirl - Do Not Shake.</li></ul>'+
    '<h2>Storage</h2><table><tr><th>State</th><th>Temperature</th><th>Window</th></tr><tr><td>Dry (Lyophilized)</td><td>Fridge / Freezer</td><td>3-6 Months+</td></tr><tr><td>Reconstituted (BAC Water)</td><td>Fridge 36-46F</td><td>~28-30 Days</td></tr></table><ul><li>Keep Out Of Light. Minimize Freeze-Thaw Cycles. Do Not Freeze Liquid.</li></ul>'+
    '<h2>Reading A COA</h2><ul><li><b>Mass Spec</b> Confirms Identity. <b>HPLC %</b> Confirms Purity. No COA = Red Flag.</li></ul>'+
    '<h2>Key Terms</h2><ul><li><b>Half-Life:</b> Time For Half A Dose To Clear - Drives How Often It Is Used.</li><li><b>Secretagogue:</b> Something That Triggers The Body To Release A Hormone.</li><li><b>Bioavailability:</b> How Much Of A Dose Reaches The Bloodstream.</li></ul>'+
    '<div class="note"><b>Research Use Only.</b> This Sheet Summarizes Laboratory Research Concepts. Nothing Here Is Medical Advice Or Approved For Human Use.</div>'+
    '</body></html>';
  }
  function printCheat(){
    try{
      var w=window.open('','_blank');
      if(!w){ return; }
      w.document.open(); w.document.write(cheatHTML()); w.document.close();
      setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} }, 350);
    }catch(e){}
  }
  function buildCheat(){
    var host=qs('#certBlock'); if(!host || qs('#cheatBtn')) return;
    var btn=el('<button class="btn btn-secondary" id="cheatBtn" style="margin-top:10px;width:100%;" aria-label="Download Printable Cheat Sheet">'+ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',16)+'Download Cheat Sheet</button>');
    btn.addEventListener('click',printCheat);
    host.appendChild(btn);
  }

  window.P101v6={ syr:function(d){ syrDose=d; syrRender(); }, cheat:printCheat };

  function ready(){ return !!document.getElementById('s8'); }
  function init(){
    if(window.__p101v6) return; window.__p101v6=1;
    buildSyringe();
    buildShelfLink();
    buildCheat();
  }
  function boot(){ if(ready()){init();return;} var n=0,t=setInterval(function(){ if(ready()||n++>80){clearInterval(t);init();} },40); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,40);});
  else setTimeout(boot,40);
})();
