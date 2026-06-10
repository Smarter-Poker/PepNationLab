

/* =====================================================================
   PEPTIDE 101 v4 - DEPTH & VISUAL AIDS
   Appended after the v3 engine. Adds: Peptide Explorer (catalog screen
   s16), interactive 20-amino-acid grid (Module 1), Peptides-vs-others
   comparison table (Module 11), and deeper data (more dosing rows +
   more glossary terms). All idempotent; runs after v3 init.
   ===================================================================== */
(function(){
  function qs(s,r){return (r||document).querySelector(s);}
  function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function el(h){var d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild;}
  function ic(d,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||2)+'">'+d+'</svg>';}
  function go(id){ if(window.P101&&P101.go) P101.go(id); else if(window.goTo) window.goTo(id); }

  /* ---------- PEPTIDE EXPLORER DATA ---------- */
  var PEPTIDES=[
    {n:'BPC-157',s:'bpc-157',f:'Recovery',u:'Tissue, Tendon, And Gut Repair',h:'~4 Hrs',r:'Sub-Q Or IM',m:'A Stomach-Derived Peptide Studied For Tissue And Gut Repair.'},
    {n:'TB-500',s:'tb-500',f:'Recovery',u:'Cell Migration And Recovery',h:'~2-3 Days',r:'Sub-Q',m:'A Fragment Of Thymosin Beta-4, Studied For Cell Repair And Movement.'},
    {n:'GHK-Cu',s:'ghk-cu',f:'Recovery',u:'Skin, Collagen, And Wound Signaling',h:'~1 Hr',r:'Sub-Q Or Topical',m:'A Copper-Binding Peptide Studied For Skin And Collagen.'},
    {n:'Sermorelin',s:'sermorelin',f:'Growth',u:'Growth Hormone Release',h:'~10-20 Min',r:'Sub-Q',m:'A GHRH Analogue That Signals The Pituitary To Release GH.'},
    {n:'CJC-1295',s:'cjc-1295',f:'Growth',u:'Sustained GH And IGF-1',h:'~6-8 Days (DAC)',r:'Sub-Q',m:'A Long-Acting GHRH Analogue Studied For Steady GH And IGF-1.'},
    {n:'Ipamorelin',s:'ipamorelin',f:'Growth',u:'Selective GH Release',h:'~2 Hrs',r:'Sub-Q',m:'A Selective Ghrelin Mimetic Studied For Clean GH Release.'},
    {n:'GHRP-6',s:'ghrp-6',f:'Growth',u:'GH Release And Appetite',h:'~15-30 Min',r:'Sub-Q',m:'A Ghrelin Mimetic Studied For GH Release And Appetite.'},
    {n:'Hexarelin',s:'hexarelin',f:'Growth',u:'Strong GH Release',h:'~30-60 Min',r:'Sub-Q',m:'A Strong Ghrelin Mimetic Studied For GH Release.'},
    {n:'Tesamorelin',s:'tesamorelin',f:'Growth',u:'Visceral Fat And GH',h:'~26-38 Min',r:'Sub-Q',m:'A GHRH Analogue Studied For Visceral Fat And GH.'},
    {n:'AOD-9604',s:'aod-9604',f:'Metabolic',u:'Fat Metabolism',h:'~30 Min',r:'Sub-Q',m:'A Fragment Of Growth Hormone Studied For Fat Metabolism.'},
    {n:'Fragment 176-191',s:'fragment-176-191',f:'Metabolic',u:'Fat Loss (Lipolysis)',h:'~30 Min',r:'Sub-Q',m:'The Fat-Loss Region Of Growth Hormone, Studied For Lipolysis.'},
    {n:'MOTS-c',s:'mots-c',f:'Metabolic',u:'Metabolic Regulation',h:'~Hours',r:'Sub-Q',m:'A Mitochondria-Derived Peptide Studied For Metabolism.'},
    {n:'PT-141',s:'pt-141',f:'Melanocortin',u:'Arousal Pathways',h:'~2-3 Hrs',r:'Sub-Q Or Intranasal',m:'A Melanocortin Agonist Studied For Arousal Pathways.'},
    {n:'Melanotan II',s:'melanotan-ii',f:'Melanocortin',u:'Pigmentation',h:'~Hours',r:'Sub-Q',m:'A Melanocortin Agonist Studied For Pigmentation.'},
    {n:'Selank',s:'selank',f:'Cognitive',u:'Calm And Focus',h:'~Minutes',r:'Intranasal Or Sub-Q',m:'A Tuftsin-Based Peptide Studied For Calm And Focus.'},
    {n:'Semax',s:'semax',f:'Cognitive',u:'Focus And Neuroprotection',h:'~Minutes',r:'Intranasal Or Sub-Q',m:'An ACTH-Fragment Peptide Studied For Focus And Neuroprotection.'},
    {n:'Epithalon',s:'epithalon',f:'Anti-Aging',u:'Aging And Longevity Markers',h:'~Minutes',r:'Sub-Q',m:'A Pineal Tetrapeptide Studied For Aging Markers.'},
    {n:'DSIP',s:'dsip',f:'Cognitive',u:'Sleep Regulation',h:'~Minutes',r:'Sub-Q',m:'Delta Sleep-Inducing Peptide, Studied For Sleep Regulation.'}
  ];
  var FAMS=['All','Recovery','Growth','Metabolic','Melanocortin','Cognitive','Anti-Aging'];
  var pexF='All', pexQ='', pexSel=null;

  /* ---------- AMINO ACID DATA ---------- */
  var AMINO=[
    ['Gly','Glycine','np','The Smallest, Most Flexible Block'],['Ala','Alanine','np','Small And Simple'],
    ['Val','Valine','np','Water-Avoiding'],['Leu','Leucine','np','Common In Muscle Protein'],
    ['Ile','Isoleucine','np','Water-Avoiding Branch'],['Pro','Proline','np','Creates Kinks And Turns'],
    ['Phe','Phenylalanine','np','Large Ring, Water-Avoiding'],['Met','Methionine','np','The Usual Starter Block'],
    ['Trp','Tryptophan','np','The Largest Block'],['Ser','Serine','po','Water-Loving'],
    ['Thr','Threonine','po','Water-Loving'],['Cys','Cysteine','po','Forms Bridges That Lock Shape'],
    ['Tyr','Tyrosine','po','Ring With A Water-Loving Tip'],['Asn','Asparagine','po','Water-Loving'],
    ['Gln','Glutamine','po','Water-Loving'],['Asp','Aspartate','ac','Carries A Negative Charge'],
    ['Glu','Glutamate','ac','Carries A Negative Charge'],['Lys','Lysine','ba','Carries A Positive Charge'],
    ['Arg','Arginine','ba','Strongly Positive'],['His','Histidine','ba','Switchable Charge']
  ];
  var CATNAME={np:'Water-Avoiding',po:'Water-Loving',ac:'Acidic (Negative)',ba:'Basic (Positive)'};

  /* ---------- DEEPER DATA: extra dosing rows + glossary ---------- */
  var NEWDOSE=[
    ["GHRP-6","100-300 mcg","1-3x Daily","~15-30 min","Sub-Q"],
    ["Hexarelin","100 mcg","1-2x Daily","~30-60 min","Sub-Q"],
    ["Tesamorelin","1-2 mg","Daily","~26-38 min","Sub-Q"],
    ["Fragment 176-191","250-500 mcg","Daily","~30 min","Sub-Q"],
    ["MOTS-c","5-10 mg","2-3x Weekly","~Hours","Sub-Q"],
    ["Melanotan II","0.25-1 mg","As Needed","~Hours","Sub-Q"],
    ["Selank","250-500 mcg","Daily","~Minutes","Intranasal Or Sub-Q"],
    ["Semax","200-600 mcg","Daily","~Minutes","Intranasal Or Sub-Q"],
    ["Epithalon","5-10 mg","Daily (Cycled)","~Minutes","Sub-Q"]
  ];
  var NEWGLOSS=[
    {term:"Agonist",def:"A Molecule That Switches A Receptor ON, Like A Key That Turns The Lock."},
    {term:"Receptor",def:"A Lock On A Cell That A Peptide Key Fits Into To Send A Signal."},
    {term:"Secretagogue (Seh-KREET-Uh-Gog)",def:"Something That Tells The Body To Release (Secrete) A Hormone. GH Secretagogues Trigger Growth Hormone."},
    {term:"Ghrelin (GREL-In)",def:"The Hunger Hormone. Some Peptides Copy It To Trigger Growth Hormone Release."},
    {term:"Bioavailability",def:"How Much Of A Dose Actually Reaches The Bloodstream. Swallowed Peptides Have Very Low Bioavailability."},
    {term:"HPLC",def:"High-Performance Liquid Chromatography. A Lab Test That Measures How Pure A Peptide Is (Shown As A Percent)."},
    {term:"Mass Spectrometry",def:"A Lab Test That Weighs Molecules To Confirm A Peptide Is Exactly What The Label Says."},
    {term:"Endotoxin",def:"A Harmful Byproduct Of Bacteria. A Good COA Confirms A Batch Is Endotoxin-Free."},
    {term:"Anabolic",def:"Building Up Tissue, Like Muscle. Steroids Are Strongly Anabolic; Peptides Are Gentler Signals."},
    {term:"Nootropic (No-Uh-TROP-Ic)",def:"Something Studied For Focus, Memory, Or Mental Clarity."},
    {term:"Collagen",def:"The Protein That Holds Skin, Tendon, And Connective Tissue Together."},
    {term:"Intranasal",def:"Given As A Spray Into The Nose. Some Peptides Like Selank And Semax Are Used This Way."}
  ];

  /* ---------- EXTEND DOSING + GLOSSARY ---------- */
  function extendData(){
    try{
      if(typeof doseData!=='undefined' && !doseData.__v4){
        var have={}; doseData.forEach(function(r){have[r[0]]=1;});
        NEWDOSE.forEach(function(r){ if(!have[r[0]]) doseData.push(r); });
        doseData.__v4=1;
        if(typeof filterDose==='function'){ var inp=qs('#doseSearch'); if(inp) filterDose(); else if(typeof renderDoseTable==='function'){ if(typeof doseFiltered!=='undefined'){} renderDoseTable(); } }
        else if(typeof renderDoseTable==='function') renderDoseTable();
      }
    }catch(e){}
    try{
      if(typeof glossaryTerms!=='undefined' && !glossaryTerms.__v4){
        var g={}; glossaryTerms.forEach(function(t){g[t.term.toLowerCase().replace(/\s*\(.*\)/,'')]=1;});
        NEWGLOSS.forEach(function(t){ var key=t.term.toLowerCase().replace(/\s*\(.*\)/,''); if(!g[key]) glossaryTerms.push(t); });
        glossaryTerms.__v4=1;
      }
    }catch(e){}
  }

  /* ---------- PEPTIDE EXPLORER ---------- */
  function pexCardHTML(p){
    return '<button class="pex-card" data-slug="'+p.s+'" onclick="P101v4.pick(\''+p.s+'\')">'+
      '<div class="pex-card-top"><span class="pex-name">'+p.n+'</span><span class="pex-chip pex-'+p.f.toLowerCase().replace(/[^a-z]/g,'')+'">'+p.f+'</span></div>'+
      '<div class="pex-use">'+p.u+'</div></button>';
  }
  function pexRender(){
    var grid=qs('#pexGrid'); if(!grid) return;
    var list=PEPTIDES.filter(function(p){
      if(pexF!=='All' && p.f!==pexF) return false;
      if(pexQ){ var q=pexQ.toLowerCase(); if((p.n+' '+p.f+' '+p.u+' '+p.m).toLowerCase().indexOf(q)<0) return false; }
      return true;
    });
    grid.innerHTML = list.length? list.map(pexCardHTML).join('') : '<div style="grid-column:1/-1;text-align:center;color:var(--muted);font-size:13px;padding:24px;">No Peptides Match Your Search.</div>';
    qsa('#pexChips .pex-fchip').forEach(function(c){ c.classList.toggle('active', c.dataset.fam===pexF); });
    var cnt=qs('#pexCount'); if(cnt) cnt.textContent=list.length+' Of '+PEPTIDES.length;
  }
  function pexPick(slug){
    var p=PEPTIDES.filter(function(x){return x.s===slug;})[0]; if(!p) return; pexSel=slug;
    var d=qs('#pexDetail'); if(!d) return;
    d.innerHTML='<div class="pex-d-head"><div><div class="pex-d-name">'+p.n+'</div><span class="pex-chip pex-'+p.f.toLowerCase().replace(/[^a-z]/g,'')+'">'+p.f+'</span></div>'+
      '<a class="lib-link" href="/research/compounds/'+p.s+'">'+ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>')+'Research Library</a></div>'+
      '<p class="pex-d-m">'+p.m+'</p>'+
      '<div class="pex-d-grid">'+
      '<div><div class="pex-d-lbl">Studied For</div><div class="pex-d-val">'+p.u+'</div></div>'+
      '<div><div class="pex-d-lbl">Family</div><div class="pex-d-val">'+p.f+'</div></div>'+
      '<div><div class="pex-d-lbl">Half-Life</div><div class="pex-d-val">'+p.h+'</div></div>'+
      '<div><div class="pex-d-lbl">Research Route</div><div class="pex-d-val">'+p.r+'</div></div>'+
      '</div>';
    d.classList.add('show');
    qsa('#pexGrid .pex-card').forEach(function(c){ c.classList.toggle('sel', c.dataset.slug===slug); });
    d.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function buildExplorer(){
    if(document.getElementById('s16')) return;
    var app=qs('#app'); if(!app) return;
    var chips=FAMS.map(function(f){return '<button class="pex-fchip'+(f==='All'?' active':'')+'" data-fam="'+f+'" onclick="P101v4.fam(\''+f+'\')">'+f+'</button>';}).join('');
    var sc=el('<div class="screen" id="s16"></div>');
    sc.innerHTML='<div class="badge badge-teal">Reference - Peptide Explorer</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">Peptide Explorer</h2>'+
      '<p style="margin-bottom:16px;">Browse The Research Peptides Covered In This Course. Search Or Filter By Family, Then Tap Any Peptide For The Details - And A Link To Its Full Research Library Page.</p>'+
      '<input type="text" id="pexSearch" class="calc-input" placeholder="Search By Name, Family, Or Use..." oninput="P101v4.search(this.value)" aria-label="Search Peptides" style="margin-bottom:10px;"/>'+
      '<div id="pexChips" class="pex-chips">'+chips+'</div>'+
      '<div style="font-size:12px;color:var(--muted);margin:4px 0 10px;">Showing <span id="pexCount"></span> Peptides</div>'+
      '<div class="pex-detail" id="pexDetail"></div>'+
      '<div class="pex-grid" id="pexGrid"></div>'+
      '<div class="callout callout-red" style="margin-top:18px;"><strong style="color:var(--red);">Research Use Only:</strong> This Reference Describes Compounds Studied In Laboratories. None Are Approved Medicines Or Instructions For People.</div>'+
      '<div class="nav-ctrl"><button class="btn btn-ghost" onclick="P101v4.back()">'+ic('<path d="M19 12H5M12 19l-7-7 7-7"/>').replace('<svg','<svg width="16" height="16"')+'Back To Course</button><div></div></div>';
    app.appendChild(sc);
    pexRender();
  }
  function addExplorerButtons(){
    // Overview (s0): We removed the secondary CTA here because we moved it to the stat card.
    /*
    var sl=qs('#s0 .btn-xl');
    if(sl && !qs('#pexOpenS0')){
      var wrap=el('<div style="text-align:center;margin:-14px 0 26px;"><button class="btn btn-secondary" id="pexOpenS0" onclick="P101v4.open()">'+ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>').replace('<svg','<svg width="18" height="18"')+'Explore All Peptides</button></div>');
      var par=sl.parentNode; if(par&&par.parentNode){ par.parentNode.insertBefore(wrap, par.nextSibling); }
    }
    */
    // Completion (s10): inside the continue-learning card
    var cl=qs('#continueLearning');
    if(cl && !qs('#pexOpenS10')){
      cl.appendChild(el('<div class="lib-links" style="margin-top:8px;"><button class="lib-link" id="pexOpenS10" onclick="P101v4.open()">'+ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>')+'Open The Peptide Explorer</button></div>'));
    }
  }

  /* ---------- AMINO GRID (Module 1) ---------- */
  function buildAminoGrid(){
    var s1=qs('#s1'); if(!s1 || qs('#aminoGrid')) return;
    var tiles=AMINO.map(function(a,i){return '<button class="amino-tile amino-'+a[2]+'" data-i="'+i+'" onclick="P101v4.amino('+i+')" title="'+a[1]+'">'+a[0]+'</button>';}).join('');
    var card=el('<div class="card" id="aminoGrid"><h3 style="font-size:15px;margin-bottom:6px;">The 20 Building Blocks</h3>'+
      '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Every Peptide Is Built From These 20 Amino Acids. Tap One To See What It Does. The Colors Group Them By Personality.</p>'+
      '<div class="amino-wrap">'+tiles+'</div>'+
      '<div class="amino-info" id="aminoInfo">Tap A Block Above To Learn About It.</div>'+
      '<div class="amino-legend"><span><i class="amino-dot amino-np"></i>Water-Avoiding</span><span><i class="amino-dot amino-po"></i>Water-Loving</span><span><i class="amino-dot amino-ac"></i>Acidic</span><span><i class="amino-dot amino-ba"></i>Basic</span></div></div>');
    // insert after the card-nickel (the 2-50 vs 51+ size card), else after the first h2
    var anchor=qs('#s1 .card-nickel');
    if(anchor && anchor.parentNode){ anchor.parentNode.insertBefore(card, anchor.nextSibling); }
    else { var h2=qs('#s1 h2'); if(h2&&h2.parentNode) h2.parentNode.insertBefore(card, h2.nextSibling); else s1.insertBefore(card, s1.firstChild); }
  }
  function aminoPick(i){
    var a=AMINO[i]; if(!a) return;
    qsa('#aminoGrid .amino-tile').forEach(function(t){ t.classList.toggle('sel', t.dataset.i===String(i)); });
    var info=qs('#aminoInfo'); if(info) info.innerHTML='<strong style="color:var(--teal);">'+a[1]+' ('+a[0]+')</strong> - '+a[3]+'. <span style="color:var(--muted);">Group: '+CATNAME[a[2]]+'.</span>';
  }

  /* ---------- COMPARISON TABLE (Module 11) ---------- */
  function buildComparison(){
    var s11=qs('#s11'); if(!s11 || qs('#cmpTable')) return;
    var rows=[
      ['What It Is','Short Amino-Acid Chain','Lab-Made Hormone','Synthetic Muscle Molecule','Long Amino-Acid Chain'],
      ['Size','Small (2-50 Blocks)','Small Molecule','Small Molecule','Large (51+ Blocks)'],
      ['How It Acts','Gentle, Specific Signal','Strong, Broad Effect','Targets Muscle Receptors','Many Different Jobs'],
      ['Lasts In The Body','Minutes To Hours','Days To Weeks','Hours To Days','Varies'],
      ['Approved Medicine?','No - Research Only','Some Are','No','Some Are']
    ];
    var head='<tr><th></th><th class="cmp-hi">Peptide</th><th>Steroid</th><th>SARM</th><th>Protein</th></tr>';
    var body=rows.map(function(r){return '<tr><td class="cmp-lbl">'+r[0]+'</td><td class="cmp-hi">'+r[1]+'</td><td>'+r[2]+'</td><td>'+r[3]+'</td><td>'+r[4]+'</td></tr>';}).join('');
    var card=el('<div class="card" id="cmpTable"><h3 style="font-size:15px;margin-bottom:6px;">Peptides Vs. The Things People Mix Them Up With</h3>'+
      '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">A Side-By-Side So The Difference Is Obvious.</p>'+
      '<div class="cmp-scroll"><table class="cmp"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div></div>');
    var nc=s11.querySelector('.nav-ctrl'); if(nc) s11.insertBefore(card, nc); else s11.appendChild(card);
  }

  /* ---------- EXPOSE ---------- */
  window.P101v4={
    open:function(){ window.location.href = '/research/catalog'; },
    back:function(){ go('s0'); },
    pick:pexPick,
    fam:function(f){ pexF=f; pexRender(); },
    search:function(v){ pexQ=v||''; pexRender(); },
    amino:aminoPick
  };

  /* ---------- INIT (after v3) ---------- */
  function ready(){ return !!(document.getElementById('s1') && document.getElementById('s11') && document.getElementById('app')); }
  function v4init(){
    if(window.__p101v4) return; window.__p101v4=1;
    extendData();
    buildExplorer();
    addExplorerButtons();
    buildComparison();
  }
  function boot(){
    if(ready()){ v4init(); return; }
    var n=0, t=setInterval(function(){ if(ready()||n++>60){ clearInterval(t); v4init(); } },40);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,8);});
  else setTimeout(boot,8);
})();
