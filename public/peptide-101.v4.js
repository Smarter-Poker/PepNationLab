

/* =====================================================================
   PEPTIDE 101 v4 - DEPTH & VISUAL AIDS
   Appended after the v3 engine. Adds: Peptide Explorer (catalog screen
   s16), interactive 20-amino-acid grid (Module 1), Peptides-vs-others
   comparison table (Module 11), and deeper data (more dosing rows +
   more glossary terms). All idempotent; runs after v3 init.
   Catalog mirrors the live Research Library compounds table; each card
   deep-links to the canonical monograph at /research/{slug}.
   ===================================================================== */
(function(){
  function qs(s,r){return (r||document).querySelector(s);}
  function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function el(h){var d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild;}
  function ic(d,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||2)+'">'+d+'</svg>';}
  function go(id){ if(window.P101&&P101.go) P101.go(id); else if(window.goTo) window.goTo(id); }

  /* ---------- PEPTIDE EXPLORER DATA (live Research Library catalog) ---------- */
  var PEPTIDES=[
    {n:'5-Amino-1MQ',s:'5-amino-1mq',f:'Metabolic',u:'Fat Loss And Metabolism',h:'~4 Hrs',r:'Oral',m:'A Small Molecule Studied For Releasing The Cellular Brake On Fat Burning (NNMT Inhibition).'},
    {n:'Acetic Acid 0.6%',s:'acetic-acid',f:'Support',u:'Peptide Reconstitution',h:'~15-30 Min',r:'Diluent',m:'A Mild Acidic Diluent Used To Dissolve Hard-To-Reconstitute Peptides.'},
    {n:'AHK-Cu',s:'ahk-cu',f:'Skin',u:'Hair And Scalp',h:'~5-10 Min',r:'Topical Or Sub-Q',m:'A Copper Tripeptide Studied For Waking Up Hair Follicles And Scalp Health.'},
    {n:'AICAR',s:'aicar',f:'Metabolic',u:'Endurance And AMPK',h:'~2 Hrs',r:'Sub-Q',m:'An AMPK Activator Studied As An Exercise Mimetic For Endurance And Fat Oxidation.'},
    {n:'AOD9604',s:'aod9604',f:'Metabolic',u:'Stubborn Fat Loss',h:'~3 Min',r:'Sub-Q',m:'A Growth-Hormone Fragment Studied Only For Burning Fat, Without Affecting Blood Sugar.'},
    {n:'ARA-290',s:'ara-290',f:'Recovery',u:'Nerve Repair',h:'~2 Min',r:'Sub-Q',m:'An EPO-Derived Peptide Studied For Calming Nerve Inflammation And Repairing Small Nerve Fibers.'},
    {n:'Bacteriostatic Water',s:'bac-water',f:'Support',u:'Peptide Reconstitution',h:'~1.5 Hrs',r:'Diluent',m:'Sterile Water With A Trace Of Alcohol That Keeps Reconstituted Peptides Germ-Free.'},
    {n:'BPC-157',s:'bpc-157',f:'Recovery',u:'Tissue And Gut Repair',h:'~30 Min',r:'Sub-Q Or Oral',m:'A Gastric-Derived Peptide Studied For Fast Repair Of Muscle, Tendon, Joint, And Gut.'},
    {n:'Cagrilintide',s:'cagrilintide',f:'Metabolic',u:'Appetite And Weight',h:'~1 Week',r:'Sub-Q',m:'A Long-Acting Amylin Analog Studied For Strong, Lasting Fullness And Weight Loss.'},
    {n:'Cerebrolysin',s:'cerebrolysin',f:'Cognitive',u:'Brain Repair',h:'~20-30 Min',r:'Sub-Q Or IM',m:'A Neurotrophic Peptide Blend Studied For Healing Brain Cells After Stroke Or Injury.'},
    {n:'CJC-1295 With DAC',s:'cjc-1295-dac',f:'Growth Hormone',u:'Sustained GH And IGF-1',h:'~6-8 Days',r:'Sub-Q',m:'A Long-Acting GHRH Analog Studied For Steady, Week-Long Growth Hormone Release.'},
    {n:'CJC-1295 Without DAC',s:'cjc-1295-no-dac',f:'Growth Hormone',u:'Pulsed GH Release',h:'~30 Min',r:'Sub-Q',m:'A Short-Acting GHRH Analog Studied For Quick Pulses Of Growth Hormone.'},
    {n:'DSIP',s:'dsip',f:'Cognitive',u:'Deep Sleep',h:'~15 Min',r:'Sub-Q',m:'Delta Sleep-Inducing Peptide, Studied For Deeper, More Restful Sleep.'},
    {n:'Epithalon',s:'epithalon',f:'Longevity',u:'Telomeres And Aging',h:'~10-15 Min',r:'Sub-Q',m:'A Pineal Tetrapeptide Studied For Rebuilding Telomeres And Slowing Aging.'},
    {n:'Follistatin',s:'follistatin',f:'Growth Hormone',u:'Muscle Growth',h:'~2 Hrs',r:'Sub-Q',m:'A Myostatin Blocker Studied For Releasing The Natural Brake On Muscle Growth.'},
    {n:'FOXO4-DRI',s:'foxo4-dri',f:'Longevity',u:'Senescent Cell Clearing',h:'~24-36 Hrs',r:'Sub-Q',m:'A Senolytic Peptide Studied For Clearing Aged Zombie Cells While Sparing Healthy Ones.'},
    {n:'GHK-Cu',s:'ghk-cu',f:'Skin',u:'Skin And Collagen',h:'~5-10 Min',r:'Topical Or Sub-Q',m:'A Copper Tripeptide Studied For Collagen, Skin Repair, And Hair.'},
    {n:'GHRP-2',s:'ghrp-2',f:'Growth Hormone',u:'GH And Appetite',h:'~30 Min',r:'Sub-Q',m:'A Ghrelin-Mimetic Secretagogue Studied For Strong Growth Hormone Release.'},
    {n:'GHRP-6',s:'ghrp-6',f:'Growth Hormone',u:'GH And Hunger',h:'~2.5 Hrs',r:'Sub-Q',m:'A First-Generation Secretagogue Studied For GH Release And Strong Appetite.'},
    {n:'Glutathione',s:'glutathione',f:'Support',u:'Antioxidant And Detox',h:'~10-15 Min',r:'Sub-Q Or IV',m:'The Master Cellular Antioxidant, Studied For Detox And Cellular Protection.'},
    {n:'HCG',s:'hcg',f:'Hormonal',u:'Testosterone And Fertility',h:'~24-36 Hrs',r:'Sub-Q',m:'An LH Analog Studied For Natural Testosterone Production And Fertility Support.'},
    {n:'Hexarelin',s:'hexarelin',f:'Growth Hormone',u:'Strong GH Release',h:'~55 Min',r:'Sub-Q',m:'A Potent Secretagogue Studied For Large GH Pulses And Cardiac Protection.'},
    {n:'HGH Fragment 176-191',s:'hgh-fragment-176-191',f:'Metabolic',u:'Fat Burning',h:'~3 Min',r:'Sub-Q',m:'The Fat-Burning Tail Of Growth Hormone, Studied For Lipolysis Without GH Side Effects.'},
    {n:'HMG',s:'hmg',f:'Hormonal',u:'Fertility',h:'~11-23 Hrs',r:'Sub-Q Or IM',m:'A Combined FSH And LH Extract Studied For Fertility And Sperm Or Egg Production.'},
    {n:'IGF-1 LR3',s:'igf-1-lr3',f:'Growth Hormone',u:'Muscle Building',h:'~20-30 Hrs',r:'Sub-Q',m:'A Long-Acting IGF-1 Analog Studied For Creating New Muscle Cells.'},
    {n:'Ipamorelin',s:'ipamorelin',f:'Growth Hormone',u:'Clean GH Release',h:'~2 Hrs',r:'Sub-Q',m:'A Selective Secretagogue Studied For Gentle GH Release Without Hunger Or Cortisol.'},
    {n:'Kisspeptin-10',s:'kisspeptin-10',f:'Hormonal',u:'Hormone Cascade',h:'~4 Min',r:'Sub-Q',m:'The First Domino In The Hormone Chain, Studied For Testosterone And Fertility.'},
    {n:'KPV',s:'kpv',f:'Recovery',u:'Inflammation And Gut',h:'~1.5 Hrs',r:'Sub-Q Or Oral',m:'An Alpha-MSH Fragment Studied For Calming Gut And Skin Inflammation.'},
    {n:'LL-37',s:'ll-37',f:'Immune',u:'Antimicrobial Defense',h:'~30 Min',r:'Sub-Q',m:'A Natural Host-Defense Peptide Studied For Attacking Bacteria And Biofilms.'},
    {n:'Melatonin',s:'melatonin',f:'Cognitive',u:'Sleep And Rhythm',h:'~20-50 Min',r:'Oral',m:'A Natural Sleep Hormone Studied For Circadian Rhythm And Antioxidant Effects.'},
    {n:'MOTS-c',s:'mots-c',f:'Metabolic',u:'Energy And Endurance',h:'~30 Min',r:'Sub-Q',m:'A Mitochondrial Peptide Studied As Exercise-In-A-Bottle For Metabolism And Stamina.'},
    {n:'MT-1',s:'mt-1',f:'Skin',u:'Tanning And UV',h:'~30 Min',r:'Sub-Q',m:'A Melanocortin Analog Studied For Sunless Tanning And UV Protection.'},
    {n:'NAD+',s:'nad-plus',f:'Longevity',u:'Cellular Energy',h:'~2-4 Hrs',r:'Oral Or IV',m:'A Core Cellular Coenzyme Studied For Energy, Repair, And Longevity.'},
    {n:'Oxytocin',s:'oxytocin',f:'Hormonal',u:'Bonding And Mood',h:'~3-5 Min',r:'Intranasal',m:'The Bonding Hormone, Studied For Trust, Connection, And Lower Stress.'},
    {n:'Pinealon',s:'pinealon',f:'Cognitive',u:'Brain Protection',h:'~5-10 Min',r:'Sub-Q',m:'A Peptide Bioregulator Studied For Protecting Brain Cells And Memory.'},
    {n:'PT-141',s:'pt-141',f:'Hormonal',u:'Arousal',h:'~2.7 Hrs',r:'Sub-Q Or Intranasal',m:'A Melanocortin Agonist Studied For Sexual Desire Through The Brain.'},
    {n:'Retatrutide',s:'retatrutide',f:'Metabolic',u:'Weight Loss',h:'~1 Week',r:'Sub-Q',m:'A Triple GIP/GLP-1/Glucagon Agonist Studied For Powerful Weight Loss.'},
    {n:'Selank',s:'selank',f:'Cognitive',u:'Calm And Focus',h:'~2 Min',r:'Intranasal Or Sub-Q',m:'A Tuftsin-Based Peptide Studied For Anxiety Relief Without Sedation.'},
    {n:'Semaglutide',s:'semaglutide',f:'Metabolic',u:'Weight And Blood Sugar',h:'~1 Week',r:'Sub-Q',m:'A GLP-1 Agonist Studied For Appetite Control, Weight Loss, And Blood Sugar.'},
    {n:'Semax',s:'semax',f:'Cognitive',u:'Focus And Memory',h:'~5 Min',r:'Intranasal Or Sub-Q',m:'An ACTH-Fragment Peptide Studied For Focus, Memory, And Neuroprotection.'},
    {n:'Sermorelin',s:'sermorelin',f:'Growth Hormone',u:'GH Support',h:'~10-20 Min',r:'Sub-Q',m:'A GHRH Fragment Studied As A Gentle Reminder For The Body To Make GH.'},
    {n:'SNAP-8',s:'snap-8',f:'Skin',u:'Wrinkles',h:'~1-2 Hrs',r:'Topical',m:'A Peptide Studied As Topical Botox-Like Relaxation Of Expression Lines.'},
    {n:'SS-31',s:'ss-31',f:'Longevity',u:'Mitochondrial Repair',h:'~4 Hrs',r:'Sub-Q',m:'A Mitochondria-Targeted Peptide Studied For Repairing Cellular Engines.'},
    {n:'Survodutide',s:'survodutide',f:'Metabolic',u:'Weight And Liver',h:'~1 Week',r:'Sub-Q',m:'A Dual GLP-1/Glucagon Agonist Studied For Weight Loss And Liver Fat.'},
    {n:'TB-500 / Thymosin Beta-4',s:'tb-500',f:'Recovery',u:'Tissue Regeneration',h:'~30 Hrs',r:'Sub-Q',m:'A Thymosin Beta-4 Peptide Studied For Stitching Torn Muscle And Tendon Back Together.'},
    {n:'Tesamorelin',s:'tesamorelin',f:'Growth Hormone',u:'Visceral Fat',h:'~26-38 Min',r:'Sub-Q',m:'A GHRH Analog Studied And Approved For Melting Stubborn Belly Fat.'},
    {n:'Thymalin',s:'thymalin',f:'Immune',u:'Immune Training',h:'~15 Min',r:'Sub-Q',m:'A Thymic Bioregulator Studied For Restoring A Youthful Immune System.'},
    {n:'Thymosin Alpha-1',s:'thymosin-alpha-1',f:'Immune',u:'Immune Boost',h:'~2 Hrs',r:'Sub-Q',m:'A Thymic Peptide Studied For Switching The Immune System On Against Infection.'},
    {n:'Tirzepatide',s:'tirzepatide',f:'Metabolic',u:'Weight And Diabetes',h:'~1 Week',r:'Sub-Q',m:'A Dual GIP/GLP-1 Agonist Studied For Strong Weight Loss And Blood Sugar Control.'},
    {n:'VIP',s:'vip',f:'Recovery',u:'Lungs And Inflammation',h:'~1-2 Min',r:'Intranasal Or Sub-Q',m:'Vasoactive Intestinal Peptide, Studied For Relaxing Vessels And Calming Inflammation.'},
    {n:'Vitamin B12',s:'b12',f:'Support',u:'Energy And Nerves',h:'~6 Days',r:'Sub-Q Or IM',m:'Cobalamin, Studied For Energy, Red Blood Cells, And Nerve Health.'}
  ];
  var FAMS=['All','Recovery','Growth Hormone','Metabolic','Hormonal','Cognitive','Longevity','Immune','Skin','Support'];
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
      '<div class="pex-d-links"><a class="lib-link" href="/research/'+p.s+'">'+ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>')+'Research Library</a>'+
      '<a class="lib-link" href="/find-a-peptide">'+ic('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>')+'Find This Peptide</a></div></div>'+
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
      '<p style="margin-bottom:16px;">Browse The Research Peptides In The Pep Nation Lab Library. Search Or Filter By Family, Then Tap Any Peptide For The Details - And A Link To Its Full Research Library Page.</p>'+
      '<input type="text" id="pexSearch" class="calc-input" placeholder="Search By Name, Family, Or Use..." oninput="P101v4.search(this.value)" aria-label="Search Peptides" style="margin-bottom:10px;"/>'+
      '<div id="pexChips" class="pex-chips" role="group" aria-label="Filter By Family">'+chips+'</div>'+
      '<div style="font-size:12px;color:var(--muted);margin:4px 0 10px;">Showing <span id="pexCount"></span> Peptides</div>'+
      '<div class="pex-detail" id="pexDetail"></div>'+
      '<div class="pex-grid" id="pexGrid"></div>'+
      '<div class="callout callout-red" style="margin-top:18px;"><strong style="color:var(--red);">Research Use Only:</strong> This Reference Describes Compounds Studied In Laboratories. None Are Approved Medicines Or Instructions For People.</div>'+
      '<div class="nav-ctrl"><button class="btn btn-ghost" onclick="P101v4.back()">'+ic('<path d="M19 12H5M12 19l-7-7 7-7"/>').replace('<svg','<svg width="16" height="16"')+'Back To Course</button><div></div></div>';
    app.appendChild(sc);
    pexRender();
  }
  function addExplorerButtons(){
    var sl=qs('#s0 .btn-xl');
    if(sl && !qs('#pexOpenS0')){
      var wrap=el('<div style="text-align:center;margin:-14px 0 26px;"><button class="btn btn-secondary" id="pexOpenS0" onclick="P101v4.open()">'+ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>').replace('<svg','<svg width="18" height="18"')+'Explore All Peptides</button></div>');
      var par=sl.parentNode; if(par&&par.parentNode){ par.parentNode.insertBefore(wrap, par.nextSibling); }
    }
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

  /* ---------- LEGACY LINK FIX ----------
     v3 + early v4 built Research Library links as /research/compounds/{slug},
     but the canonical monograph route is /research/{slug}. Repair any such
     link at click time so no module button 404s. */
  function fixLegacyLinks(){
    if(window.__p101linkfix) return; window.__p101linkfix=1;
    document.addEventListener('click', function(e){
      var t=e.target; var a=t && t.closest ? t.closest('a[href*="/research/compounds/"]') : null;
      if(a){ a.href = a.getAttribute('href').replace('/research/compounds/','/research/'); }
    }, true);
  }

  /* ---------- EXPOSE ---------- */
  window.P101v4={
    open:function(){ buildExplorer(); go('s16'); },
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
    fixLegacyLinks();
    extendData();
    buildExplorer();
    addExplorerButtons();
    buildAminoGrid();
    buildComparison();
  }
  function boot(){
    if(ready()){ v4init(); return; }
    var n=0, t=setInterval(function(){ if(ready()||n++>60){ clearInterval(t); v4init(); } },40);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,8);});
  else setTimeout(boot,8);
})();
