/* =====================================================================
   PEPTIDE 101 v8 - RICH CONTENT ENGINE (Modules 6-9)
   Sibling of v7. Rebuilds the text-heavy Families (s6) and Stacking (s7)
   modules with rich plain-language content, and ENRICHES the widget-heavy
   Reconstitution Calculator (s8) and Dosing Reference (s9) by inserting
   strong explanation above the existing tools WITHOUT wiping them, so the
   calculator, syringe visual and dosing table keep working. Each rebuild
   preserves the v3-owned nav-ctrl so completion tracking is untouched.
   ===================================================================== */
(function(){
  function qs(s,r){return (r||document).querySelector(s);}
  function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstChild;}
  function ic(d,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="'+(w||16)+'" height="'+(w||16)+'" style="flex-shrink:0;">'+d+'</svg>';}
  function card(inner,extra){ return '<div class="card"'+(extra||'')+'>'+inner+'</div>'; }
  function useCard(color,icon,title,body,chips){
    var ch=chips.map(function(c){return '<span class="badge badge-teal" style="font-size:11px;padding:3px 8px;">'+c+'</span>';}).join('');
    return '<div class="card"><div style="display:flex;align-items:flex-start;gap:14px;">'+
      '<div style="min-width:44px;height:44px;border-radius:12px;background:'+color+';display:flex;align-items:center;justify-content:center;">'+icon+'</div>'+
      '<div><strong style="font-size:15px;">'+title+'</strong><p style="font-size:13px;margin-top:4px;color:var(--silver);">'+body+'</p>'+
      '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">'+ch+'</div></div></div></div>';
  }
  function checkCard(qid,question,opts){
    var b=opts.map(function(o){return '<button class="quiz-opt" onclick="quiz(\''+qid+'\',this,'+(o[1]?'true':'false')+')">'+ic('<circle cx="12" cy="12" r="10"/>',16)+o[0]+'</button>';}).join('');
    return '<div class="card check-q"><div class="qh"><strong>Check Your Understanding</strong></div>'+
      '<p style="font-size:14px;margin:6px 0 8px;">'+question+'</p><div class="quiz-opts">'+b+'</div><div class="quiz-fb" id="'+qid+'-fb"></div></div>';
  }
  function takeaways(items){
    return '<div class="takeaways"><h4>'+ic('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')+'Key Takeaways</h4><ul>'+
      items.map(function(t){return '<li>'+ic('<path d="M20 6 9 17l-5-5"/>')+'<span>'+t+'</span></li>';}).join('')+'</ul></div>';
  }
  function note(t){ return '<div class="stop-card" style="margin-top:18px;"><strong>Research Use Only:</strong> '+t+'</div>'; }
  function rebuild(id,html){ var sc=document.getElementById(id); if(!sc) return false; var nav=sc.querySelector('.nav-ctrl'); sc.innerHTML=html; if(nav) sc.appendChild(nav); sc.setAttribute('data-v8','1'); sc.setAttribute('data-meta-done','1'); return true; }
  function enrich(id,marker,html){
    var sc=document.getElementById(id); if(!sc || sc.querySelector('#'+marker)) return;
    var h2=sc.querySelector('h2'); if(!h2) return;
    var anchor=h2, nx=h2.nextElementSibling;
    while(nx && (nx.classList.contains('why-hook') || nx.tagName==='P')){ anchor=nx; nx=nx.nextElementSibling; }
    var node=el('<div id="'+marker+'">'+html+'</div>');
    anchor.parentNode.insertBefore(node, anchor.nextSibling);
  }

  /* ---------- MODULE 6: PEPTIDE FAMILIES ---------- */
  function buildS6(){
    var teal='rgba(0,196,188,0.12)', blue='rgba(59,130,246,0.12)', sil='rgba(138,155,176,0.12)';
    var html=
      '<div class="badge badge-teal">Module 6 - Peptide Families</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">Peptide Families And Categories</h2>'+
      '<p style="margin-bottom:18px;">There Are Hundreds Of Research Peptides, But They Sort Neatly Into A Handful Of Families - Grouped By The Job They Do And The System They Target. Once You Know The Family, You Can Predict Roughly What A Peptide Does Without Memorizing Every Name.</p>'+
      useCard(teal,ic('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),'Tissue And Recovery','The Repair Crew. These Signal The Body To Heal Skin, Muscle, Tendon, And Gut, And To Calm Inflammation.',['BPC-157','TB-500','GHK-Cu'])+
      useCard(blue,ic('<path d="M18 20V10M12 20V4M6 20v-6"/>'),'Growth Hormone Axis','The Build-And-Recover Family. They Nudge The Body To Release More Of Its Own Growth Hormone.',['Sermorelin','CJC-1295','Ipamorelin'])+
      useCard(sil,ic('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>'),'Metabolic And Fat','The Energy Family. They Affect How The Body Uses Fuel And Stores Or Burns Fat.',['AOD-9604','MOTS-c','Tirzepatide'])+
      useCard(teal,ic('<path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 2 7h10c0-2 2-4 2-7a7 7 0 0 0-7-7z"/><path d="M9 21h6"/>'),'Melanocortin (Skin And Arousal)','This Family Acts On Skin Color, Appetite, And Certain Brain Signals Tied To Arousal.',['PT-141','Melanotan II'])+
      useCard(blue,ic('<path d="M12 2a10 10 0 1 0 10 10"/><path d="M8 12h8M12 8v8"/>'),'Cognitive And Mood','The Brain Family. Studied For Focus, Calm, Memory, And Protecting Brain Cells.',['Selank','Semax','DSIP'])+
      useCard(sil,ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),'Anti-Aging And Longevity','Studied For Markers Of Aging At The Cellular Level - Telomeres, Mitochondria, And Senescent Cells.',['Epithalon','NAD+','SS-31'])+
      '<div class="callout"><strong>Why Families Help:</strong> If Someone Says A Peptide Is "In The Growth Hormone Axis," You Already Know It Works By Nudging Your Body To Release Growth Hormone - Before You Read A Single Detail.</div>'+
      '<div class="lib-links" style="margin-top:6px;"><button class="lib-link" onclick="if(window.P101v4)P101v4.open()">'+ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>')+'Browse Every Family In The Peptide Explorer</button></div>'+
      checkCard('cq6','A Peptide In The "Growth Hormone Axis" Family Mainly...',[['Nudges The Body To Release Its Own Growth Hormone',1],['Numbs Pain Directly',0],['Replaces Vitamins',0]])+
      takeaways(['Peptides Group Into Families By The System They Target.','Each Family Shares A Common Job And Mechanism.','Knowing The Family Predicts What A Peptide Does.','The Peptide Explorer Lets You Filter The Whole Catalog By Family.'])+
      note('Family Groupings Are An Educational Map Of Research Compounds, Not Product Recommendations.');
    rebuild('s6',html);
  }

  /* ---------- MODULE 7: STACKING AND PROTOCOLS ---------- */
  function buildS7(){
    var diagram='<div style="overflow-x:auto;"><svg width="100%" viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg" aria-label="Two peptides converging on the pituitary to release growth hormone">'+
      '<rect x="6" y="14" width="104" height="34" rx="8" fill="#162230" stroke="#00C4BC" stroke-width="1.5"/><text x="58" y="30" fill="#00C4BC" font-size="10" text-anchor="middle" font-family="Inter,sans-serif">CJC-1295</text><text x="58" y="42" fill="#A8B4C0" font-size="8" text-anchor="middle" font-family="Inter,sans-serif">Opens The GHRH Door</text>'+
      '<rect x="6" y="102" width="104" height="34" rx="8" fill="#162230" stroke="#3B82F6" stroke-width="1.5"/><text x="58" y="118" fill="#3B82F6" font-size="10" text-anchor="middle" font-family="Inter,sans-serif">Ipamorelin</text><text x="58" y="130" fill="#A8B4C0" font-size="8" text-anchor="middle" font-family="Inter,sans-serif">Opens The Ghrelin Door</text>'+
      '<rect x="130" y="56" width="86" height="40" rx="8" fill="#1D2D3E" stroke="rgba(0,196,188,0.3)" stroke-width="1.5"/><text x="173" y="76" fill="#FFFFFF" font-size="10" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600">Pituitary</text><text x="173" y="88" fill="#A8B4C0" font-size="8" text-anchor="middle" font-family="Inter,sans-serif">Both Doors Open</text>'+
      '<path d="M110 31 Q124 31 130 66" fill="none" stroke="#00C4BC" stroke-width="1.5" stroke-dasharray="4,2"/><path d="M110 119 Q124 119 130 86" fill="none" stroke="#3B82F6" stroke-width="1.5" stroke-dasharray="4,2"/>'+
      '<rect x="236" y="56" width="80" height="40" rx="8" fill="#162230" stroke="rgba(208,218,228,0.4)" stroke-width="1.5"/><text x="276" y="76" fill="#D0DAE4" font-size="10" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600">Bigger GH</text><text x="276" y="88" fill="#A8B4C0" font-size="8" text-anchor="middle" font-family="Inter,sans-serif">Pulse</text>'+
      '<path d="M216 76 L234 76" stroke="#D0DAE4" stroke-width="1.5"/><polygon points="231,72 238,76 231,80" fill="#D0DAE4"/></svg></div>';
    var reason=function(stroke,t,b){return '<div style="padding:10px;background:var(--surface2);border-radius:10px;border-left:3px solid '+stroke+';"><strong style="font-size:13px;">'+t+'</strong><p style="font-size:12px;margin-top:4px;color:var(--silver);">'+b+'</p></div>';};
    var html=
      '<div class="badge badge-teal">Module 7 - Stacking</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">Stacking And Research Protocols</h2>'+
      '<p style="margin-bottom:18px;">Stacking Just Means Using More Than One Peptide At The Same Time. Like Mixing Two Colors Of Paint, Each One Does A Different Job, And Together They Can Reach A Result Neither Could Alone. A "Protocol" Is Simply The Plan - Which Peptides, How Much, And When.</p>'+
      card('<h3 style="font-size:15px;margin-bottom:12px;">Why Researchers Stack</h3>'+
        '<div style="display:flex;flex-direction:column;gap:8px;">'+
        reason('var(--teal)','Complementary Pathways','Two Peptides Can Push The Same Goal Through Two Different Doors At Once - A Bigger Combined Result.')+
        reason('var(--blue-l)','Local Plus Whole-Body','One Peptide Works Right At A Sore Spot While Another Travels Everywhere. Together They Cover Both.')+
        reason('var(--silver)','Timing','A Fast Peptide Used At Night Can Pair With A Long One Used Weekly, So The Signal Stays Steady.')+
        '</div>')+
      card('<h3 style="font-size:15px;margin-bottom:8px;text-align:center;">A Classic Example: The GH-Axis Stack</h3>'+
        '<p style="font-size:12px;color:var(--muted);text-align:center;margin-bottom:14px;">CJC-1295 + Ipamorelin Open Two Different Doors To The Same Gland</p>'+diagram+
        '<p style="font-size:12px;color:var(--muted);text-align:center;margin-top:10px;">Two Different Locks, One Bigger Result Than Either Alone.</p>')+
      '<div class="callout callout-red"><strong style="color:var(--red);">Research Context Only:</strong> Everything Here Describes What Scientists Study In Labs. None Of It Is Approved Medicine Or Advice For People.</div>'+
      checkCard('cq7','Stacking Works Best When The Two Peptides...',[['Hit Different Pathways So Their Effects Add Up',1],['Are Exactly The Same Peptide',0],['Cancel Each Other Out',0]])+
      takeaways(['Stacking Means Using More Than One Peptide Together.','It Works When Each Peptide Hits A Different Pathway.','Timing And Local-Vs-Whole-Body Coverage Both Matter.','A Protocol Is Just The Plan: Which, How Much, And When.'])+
      note('Stacking Examples Are Research Frameworks, Not Human Dosing Advice.');
    rebuild('s7',html);
  }

  /* ---------- MODULE 8: enrich the calculator ---------- */
  function enrichS8(){
    enrich('s8','v8s8',
      card('<h3 style="font-size:16px;margin-bottom:8px;">The Two Numbers That Matter</h3>'+
        '<p style="font-size:13px;color:var(--silver);margin-bottom:12px;">Reconstitution Sounds Technical, But It Comes Down To Two Numbers: How Much Powder Is In The Vial (mg), And How Strong You Want The Final Liquid (mcg/mL). The Water You Add Connects Them.</p>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:13px;">'+
        '<div style="flex:1;min-width:130px;padding:12px;background:var(--surface2);border-radius:10px;"><div style="color:var(--teal);font-weight:700;">1. Vial Size</div><div style="color:var(--silver);font-size:12px;margin-top:3px;">Printed On The Vial, In mg. This Is Fixed.</div></div>'+
        '<div style="flex:1;min-width:130px;padding:12px;background:var(--surface2);border-radius:10px;"><div style="color:var(--blue-l);font-weight:700;">2. Target Strength</div><div style="color:var(--silver);font-size:12px;margin-top:3px;">How Concentrated You Want It, In mcg/mL. You Choose This.</div></div>'+
        '</div>'+
        '<div class="callout" style="margin-top:12px;"><strong>The Formula:</strong> (Vial mg x 1000) / Target mcg/mL = mL Of Water To Add. More Water = Weaker Solution. Less Water = Stronger. The Calculator Below Does This Math For You And Shows You The Exact Draw On A Syringe.</div>')
    );
  }

  /* ---------- MODULE 9: enrich the dosing table ---------- */
  function enrichS9(){
    enrich('s9','v8s9',
      card('<h3 style="font-size:16px;margin-bottom:8px;">How To Read This Table</h3>'+
        '<p style="font-size:13px;color:var(--silver);margin-bottom:10px;">Every Peptide Has Its Own Amounts And Schedule. Two Columns Do Most Of The Work: The <strong>Dose Range</strong> (How Much Is Used) And The <strong>Frequency</strong> (How Often). The <strong>Half-Life</strong> Column Explains The Frequency - Short Half-Life Means More Frequent Use.</p>'+
        '<div style="display:flex;flex-direction:column;gap:7px;font-size:13px;">'+
        '<div style="padding:9px 11px;background:var(--surface2);border-radius:9px;"><strong style="color:var(--teal);">Dose Range</strong> - Usually In Micrograms (mcg) Or Milligrams (mg). 1000 mcg = 1 mg.</div>'+
        '<div style="padding:9px 11px;background:var(--surface2);border-radius:9px;"><strong style="color:var(--teal);">Frequency</strong> - How Often, From Multiple Times A Day To Once A Week.</div>'+
        '<div style="padding:9px 11px;background:var(--surface2);border-radius:9px;"><strong style="color:var(--teal);">Route</strong> - How It Is Given. Sub-Q (Under The Skin) Is The Most Common.</div>'+
        '</div>'+
        '<div class="callout callout-red" style="margin-top:12px;"><strong style="color:var(--red);">These Are Study Figures:</strong> The Numbers Below Come From Lab And Early Research. They Are Not Instructions For People, And None Of These Are Approved Medicines. Tap Any Column Heading To Sort.</div>')
    );
  }

  /* ---------- INIT ---------- */
  function ready(){ return !!(document.getElementById('s6') && document.getElementById('s8') && document.getElementById('s9')); }
  function init(){
    if(window.__p101v8) return; window.__p101v8=1;
    try{ buildS6(); }catch(e){}
    try{ buildS7(); }catch(e){}
    try{ enrichS8(); }catch(e){}
    try{ enrichS9(); }catch(e){}
  }
  function boot(){ if(ready()){init();return;} var n=0,t=setInterval(function(){ if(ready()||n++>120){clearInterval(t);init();} },40); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,90);});
  else setTimeout(boot,90);
})();
