/* =====================================================================
   PEPTIDE 101 v9 - RICH CONTENT ENGINE (Modules 10-13)
   Sibling of v7/v8. These modules (What Peptides Are NOT, Why They Are
   Injected, Safety/Purity, Legality) are created at runtime by v3, and one
   of them (s11) already carries v4's comparison table. So v9 ENRICHES each
   by inserting strong plain-language depth near the top WITHOUT wiping the
   existing content or the comparison table. v3's per-module check + nav-ctrl
   stay intact, so completion tracking is untouched.
   ===================================================================== */
(function(){
  function qs(s,r){return (r||document).querySelector(s);}
  function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstChild;}
  function ic(d,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="'+(w||16)+'" height="'+(w||16)+'" style="flex-shrink:0;">'+d+'</svg>';}
  function card(inner){ return '<div class="card">'+inner+'</div>'; }
  function rows(items){
    return '<div style="display:flex;flex-direction:column;gap:8px;">'+items.map(function(it){
      return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:var(--surface2);border-radius:9px;">'+
        '<span style="color:'+(it[2]||'var(--teal)')+';margin-top:1px;">'+ic(it[3]||'<path d="M20 6 9 17l-5-5"/>',16)+'</span>'+
        '<div><strong style="font-size:13px;">'+it[0]+'</strong><p style="font-size:12px;margin-top:3px;color:var(--silver);">'+it[1]+'</p></div></div>';
    }).join('')+'</div>';
  }
  function enrich(id,marker,html){
    var sc=document.getElementById(id); if(!sc || sc.querySelector('#'+marker)) return false;
    var h2=sc.querySelector('h2'); if(!h2) return false;
    var anchor=h2, nx=h2.nextElementSibling;
    while(nx && (nx.classList.contains('why-hook') || nx.tagName==='P')){ anchor=nx; nx=nx.nextElementSibling; }
    anchor.parentNode.insertBefore(el('<div id="'+marker+'">'+html+'</div>'), anchor.nextSibling);
    return true;
  }
  var X='var(--red)', T='var(--teal)';
  var xIcon='<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>';
  var checkIcon='<path d="M20 6 9 17l-5-5"/>';

  /* ---------- MODULE 10 (s11): WHAT PEPTIDES ARE NOT ---------- */
  function s11(){
    enrich('s11','v9s11',
      card('<h3 style="font-size:16px;margin-bottom:8px;">Clearing Up The Biggest Myths</h3>'+
        '<p style="font-size:13px;color:var(--silver);margin-bottom:12px;">More Confusion Comes From What People Think Peptides Are Than From What They Actually Are. Here Is What They Are NOT:</p>'+
        rows([
          ['They Are NOT Steroids','Steroids Are A Completely Different Molecule That Forces Broad, Powerful Changes. Peptides Are Gentle, Specific Signals That Work Through Your Body&#39;s Own Systems.',X,xIcon],
          ['They Are NOT Approved Medicines','The Research Peptides In This Course Are For Laboratory Study. They Are Not FDA-Approved Drugs And Not Prescribed Treatments.',X,xIcon],
          ['They Are NOT Magic Or Instant','A Peptide Sends A Signal - It Does Not Rebuild You Overnight. Results In Research Are Gradual And Vary.',X,xIcon],
          ['They Are NOT Proteins','Same Building Blocks, But A Peptide Is Short (2-50) And A Protein Is Long (51+). Size Changes Everything About How They Behave.',X,xIcon]
        ]))
    );
  }

  /* ---------- MODULE 11 (s12): WHY PEPTIDES ARE INJECTED ---------- */
  function s12(){
    enrich('s12','v9s12',
      card('<h3 style="font-size:16px;margin-bottom:8px;">The Stomach Problem</h3>'+
        '<p style="font-size:13px;color:var(--silver);margin-bottom:12px;">Here Is The Simple Reason Almost Every Research Peptide Is Injected: Your Stomach Is Built To Break Chains Of Amino Acids Apart - That Is Exactly How It Digests The Protein In Your Food. A Swallowed Peptide Gets Chopped Up Before It Can Ever Deliver Its Message.</p>'+
        rows([
          ['Injection Skips The Stomach','A Small Shot Just Under The Skin (Sub-Q) Puts The Peptide Straight Into The Body Intact, Where It Can Actually Work.',T,checkIcon],
          ['Sub-Q Gives A Slow, Steady Release','The Fatty Layer Under The Skin Releases The Peptide Gradually - Gentle And Even, Which Suits How Peptides Signal.',T,checkIcon],
          ['A Few Have Other Routes','Some Peptides Work As Nasal Sprays (Like Selank And Semax) Or Skin Creams (Like GHK-Cu And SNAP-8) Because They Can Cross Those Surfaces.',T,checkIcon]
        ])+
        '<div class="callout" style="margin-top:12px;"><strong>The Same Fact, Two Ways:</strong> The Reason Peptides Do Not Last Long In The Body Is The Same Reason They Cannot Survive The Stomach - They Are Easy To Break Apart. That Fragility Is Also Why Storage Matters So Much.</div>')
    );
  }

  /* ---------- MODULE 12 (s13): SAFETY, PURITY AND SOURCING ---------- */
  function s13(){
    enrich('s13','v9s13',
      card('<h3 style="font-size:16px;margin-bottom:8px;">How To Read A Certificate Of Analysis (COA)</h3>'+
        '<p style="font-size:13px;color:var(--silver);margin-bottom:12px;">This Is The Single Most Important Skill For Real Research. A COA Is The Lab Report For A Specific Batch. Two Numbers Matter Most:</p>'+
        rows([
          ['Mass Spectrometry = Identity','This Test Weighs The Molecule To Confirm It Really Is The Peptide On The Label - Not Something Else.',T,checkIcon],
          ['HPLC Purity % = Cleanliness','This Shows What Percent Of The Vial Is Actually The Peptide. Research-Grade Is Usually 98%+ . The Rest Is Leftover Junk From Manufacturing.',T,checkIcon]
        ])+
        '<h3 style="font-size:15px;margin:16px 0 8px;">Red Flags</h3>'+
        rows([
          ['No COA Available','If A Source Cannot Show A Batch COA, You Have No Idea What Is In The Vial.',X,xIcon],
          ['Price Too Good To Be True','Real Synthesis And Testing Cost Money. Suspiciously Cheap Often Means Underdosed Or Impure.',X,xIcon],
          ['Odd Color Or Clumping','Quality Peptide Powder Is Usually A Clean White. Discoloration Can Signal Degradation Or Contamination.',X,xIcon]
        ]))
    );
  }

  /* ---------- MODULE 13 (s14): LEGALITY AND RESEARCH USE ---------- */
  function s14(){
    enrich('s14','v9s14',
      card('<h3 style="font-size:16px;margin-bottom:8px;">What "Research Use Only" Actually Means</h3>'+
        '<p style="font-size:13px;color:var(--silver);margin-bottom:12px;">You Will See This Phrase On Every Vial And Every Page Of This Course. It Is Not A Loophole Or Fine Print - It Defines What These Compounds Are For.</p>'+
        rows([
          ['For The Laboratory, Not The Body','Research Peptides Are Sold And Studied As Laboratory Materials. They Are Not Approved For Human Use.',T,checkIcon],
          ['Not Approved Or Prescribed','Being "Studied For" A Condition Is Not The Same As Being Approved To Treat It. Most Research Peptides Are Years From Any Approval, If Ever.',T,checkIcon],
          ['Follow Local Laws And Rules','Rules Differ By Country, State, And Institution. Legitimate Research Always Stays Inside Local Laws And Any Institutional Guidelines.',T,checkIcon]
        ])+
        '<div class="callout callout-red" style="margin-top:12px;"><strong style="color:var(--red);">The Bottom Line:</strong> Treating These Compounds As Research Materials - Not Medicines - Is What Keeps Research Legitimate And Protects Everyone Involved.</div>')
    );
  }

  function ready(){ return !!(document.getElementById('s11') && document.getElementById('s14')); }
  function init(){
    if(window.__p101v9) return; window.__p101v9=1;
    try{ s11(); }catch(e){}
    try{ s12(); }catch(e){}
    try{ s13(); }catch(e){}
    try{ s14(); }catch(e){}
  }
  function boot(){ if(ready()){init();return;} var n=0,t=setInterval(function(){ if(ready()||n++>140){clearInterval(t);init();} },40); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,120);});
  else setTimeout(boot,120);
})();
