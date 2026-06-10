/* =====================================================================
   PEPTIDE 101 v7 - RICH CONTENT ENGINE + LOCKED HEADER
   Loaded last. Two jobs:
   1) Lock the top header (nav + progress + course tabs) so it never
      slides over content while scrolling, with content padded to clear it.
   2) Replace weak module bodies with rich, plain-language content built for
      a true beginner. Each rebuild preserves the screen's nav-ctrl (owned by
      v3, drives completion) so progress tracking is untouched. The
      building-blocks / chain-builder science is demoted into an optional,
      collapsed panel instead of leading the newbie flow. Interactive widgets
      (lock-key demo, half-life explorer, storage tabs) are recreated with the
      same element IDs so the existing global handlers keep working.
   Rolls out module by module; this batch covers Modules 1-5.
   ===================================================================== */
(function(){
  function qs(s,r){return (r||document).querySelector(s);}
  function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function ic(d,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="'+(w||16)+'" height="'+(w||16)+'" style="flex-shrink:0;">'+d+'</svg>';}

  /* ---------- 1. LOCKED HEADER (dynamic, viewport-safe) ---------- */
  function fixHeader(){
    var nav=qs('.nav'), prog=qs('.prog-wrap'), cnav=qs('.course-nav-wrap'), app=qs('.app');
    var navH=nav?nav.offsetHeight:56, progH=prog?prog.offsetHeight:46;
    if(cnav){
      cnav.style.position='fixed';
      cnav.style.top=(navH+progH)+'px';
      cnav.style.left='0'; cnav.style.right='0'; cnav.style.width='100%';
      cnav.style.maxWidth='none'; cnav.style.margin='0';
      cnav.style.zIndex='90';
      cnav.style.background='rgba(7,13,24,.97)';
      cnav.style.backdropFilter='blur(10px)';
      cnav.style.webkitBackdropFilter='blur(10px)';
      cnav.style.borderBottom='1px solid rgba(150,168,192,.14)';
      cnav.style.padding='8px 12px';
      var inner=qs('.course-nav',cnav);
      if(inner){ inner.style.maxWidth='1000px'; inner.style.margin='0 auto'; }
    }
    var cnavH=cnav?cnav.offsetHeight:52;
    if(app){ app.style.paddingTop=(navH+progH+cnavH+12)+'px'; }
  }
  function lockHeader(){
    fixHeader();
    setTimeout(fixHeader,150); setTimeout(fixHeader,500);
    window.addEventListener('resize',fixHeader);
    window.addEventListener('orientationchange',function(){setTimeout(fixHeader,200);});
  }

  /* ---------- rebuild helper: swap body, keep nav-ctrl ---------- */
  function rebuild(id, html){
    var sc=document.getElementById(id); if(!sc) return false;
    var nav=sc.querySelector('.nav-ctrl');
    sc.innerHTML=html;
    if(nav) sc.appendChild(nav);
    sc.setAttribute('data-v7','1');
    sc.setAttribute('data-meta-done','1'); // prevent any late v3 meta double-up
    return true;
  }
  function relabelRoadmap(n,title){
    qsa('#s0 .roadmap-card').forEach(function(card){
      var oc=card.getAttribute('onclick')||'';
      var byData=card.dataset&&card.dataset.mod==='s'+n;
      if(byData || oc.indexOf('goTo('+n+')')>-1){ var t=card.querySelector('.rm-title'); if(t) t.textContent=title; }
    });
  }

  /* ---------- shared building blocks ---------- */
  function card(inner,extra){ return '<div class="card"'+(extra||'')+'>'+inner+'</div>'; }
  function propRow(color,icon,title,body){
    return '<div style="display:flex;align-items:flex-start;gap:12px;">'+
      '<div style="min-width:34px;height:34px;border-radius:9px;background:'+color+';display:flex;align-items:center;justify-content:center;margin-top:2px;">'+icon+'</div>'+
      '<div><strong>'+title+'</strong><p style="font-size:13px;margin-top:3px;color:var(--silver);">'+body+'</p></div></div>';
  }
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

  /* ---------- MODULE 1: WHAT IS A PEPTIDE ---------- */
  function buildS1(){
    var teal='rgba(0,196,188,0.12)', blue='rgba(59,130,246,0.12)', sil='rgba(138,155,176,0.12)';
    var html=
      '<div class="badge badge-teal">Module 1 - The Basics</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">What Is A Peptide?</h2>'+
      '<p style="margin-bottom:18px;">A Peptide Is A Tiny Chemical Message Your Body Uses To Tell Itself What To Do. It Is A Short Chain Of Building Blocks Called Amino Acids - Usually Between 2 And 50 Of Them. You Do Not Need To Memorize Any Chemistry To Understand Peptides. Just Remember This: A Peptide Is A Small, Specific Instruction Note Passed Between Cells.</p>'+
      '<div class="card-nickel"><div style="display:flex;align-items:center;gap:16px;">'+
        '<div style="text-align:center;min-width:80px;"><div style="font-size:28px;font-weight:800;font-family:&#39;Space Grotesk&#39;,sans-serif;color:var(--teal);">2-50</div><div style="font-size:11px;color:var(--muted);">Building Blocks</div><div style="font-size:12px;font-weight:700;margin-top:4px;">Peptide</div></div>'+
        '<div style="flex:1;height:2px;background:linear-gradient(90deg,var(--teal),var(--blue));border-radius:99px;"></div>'+
        '<div style="text-align:center;min-width:80px;"><div style="font-size:28px;font-weight:800;font-family:&#39;Space Grotesk&#39;,sans-serif;color:var(--blue-l);">51+</div><div style="font-size:11px;color:var(--muted);">Building Blocks</div><div style="font-size:12px;font-weight:700;margin-top:4px;">Protein</div></div>'+
      '</div><p style="font-size:12px;color:var(--muted);margin-top:10px;text-align:center;">Same Building Blocks. The Only Difference Is Length - A Peptide Is Short, A Protein Is Long.</p></div>'+
      card('<h3 style="font-size:16px;margin-bottom:14px;">What A Peptide Actually Does</h3>'+
        '<div style="display:flex;flex-direction:column;gap:14px;">'+
        propRow(teal,ic('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),'It Sends A Message','A Peptide Is Like A Text Message For Your Cells. It Carries One Instruction To One Place - Such As Repair This, Release That Hormone, Or Calm This Inflammation.')+
        propRow(blue,ic('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'),'It Acts Fast, Then Leaves','Your Body Breaks Peptides Down Quickly - Usually In Minutes To A Few Hours. They Deliver Their Message And Disappear, So Your Body Stays In Control.')+
        propRow(sil,ic('<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/>'),'Your Body Already Makes Them','You Are Producing Hundreds Of Peptides Right Now. Researchers Often Just Study Copies Of Signals Your Body Already Knows How To Use.')+
        '</div>')+
      card('<h3 style="font-size:16px;margin-bottom:6px;">How A Peptide Works (The Short Version)</h3>'+
        '<p style="font-size:13px;color:var(--silver);margin-bottom:12px;">Every Peptide Works Like A Key. Your Cells Are Covered In Tiny Locks. A Peptide Only Does Something When Its Shape Fits One Of Those Locks - Then The Lock Turns On And The Cell Reacts.</p>'+
        '<div style="display:flex;flex-direction:column;gap:8px;">'+
        ['The Peptide (Key) Finds Its Matching Lock On A Cell.','The Lock Switches On When The Right Key Fits.','A Signal Travels Inside The Cell.','The Cell Does Its Job - Repair, Release, Calm, Grow.'].map(function(t,i){return '<div style="display:flex;align-items:center;gap:11px;padding:9px;background:var(--surface2);border-radius:9px;"><div style="min-width:24px;height:24px;border-radius:50%;background:var(--teal);color:#001;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;">'+(i+1)+'</div><span style="font-size:13px;">'+t+'</span></div>';}).join('')+
        '<p style="font-size:12px;color:var(--muted);margin-top:4px;">We Go Deeper On This In Module 3 - For Now, Just Picture A Key Fitting A Lock.</p></div>')+
      card('<h3 style="font-size:16px;margin-bottom:6px;">How Long Do They Stay In Your Body?</h3>'+
        '<p style="font-size:13px;color:var(--silver);margin-bottom:12px;">This Is One Of The Most Common Questions. Most Peptides Clear Out Fast. How Fast Is Measured By Their "Half-Life" - The Time For Half Of A Dose To Disappear. Short Half-Life Means Researchers Use It More Often.</p>'+
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:var(--surface2);"><th style="padding:9px 12px;text-align:left;">Speed</th><th style="padding:9px 12px;text-align:left;">Stays Active For</th><th style="padding:9px 12px;text-align:left;">Example</th></tr></thead><tbody>'+
        [['Fast','A Few Minutes','Sermorelin, Selank'],['Medium','A Few Hours','BPC-157, PT-141'],['Long','Days','CJC-1295 (DAC), TB-500']].map(function(r){return '<tr style="border-bottom:1px solid var(--border);"><td style="padding:9px 12px;font-weight:600;color:var(--teal);">'+r[0]+'</td><td style="padding:9px 12px;">'+r[1]+'</td><td style="padding:9px 12px;color:var(--silver);">'+r[2]+'</td></tr>';}).join('')+
        '</tbody></table></div><p style="font-size:12px;color:var(--muted);margin-top:10px;">Because They Leave Quickly, Peptides Are Usually Used On A Schedule Rather Than Once And Done.</p>')+
      '<h3 style="font-size:16px;margin:22px 0 12px;">Peptides You Already Know</h3>'+
      '<div class="grid3">'+
        ['Insulin|Controls Your Blood Sugar. It Tells Your Body To Lower Blood Sugar After You Eat.','Oxytocin|The Bonding Signal. Released During Hugs And Closeness, It Lowers Stress.','Collagen Peptides|The Skin And Joint Signal Found In Many Supplements And Skincare Products.'].map(function(x){var p=x.split('|');return '<div class="card" style="padding:16px;"><div style="font-weight:700;color:var(--teal);font-size:14px;">'+p[0]+'</div><p style="font-size:12px;margin-top:4px;color:var(--silver);">'+p[1]+'</p></div>';}).join('')+
      '</div>'+
      card('<h3 style="font-size:16px;margin-bottom:12px;">Peptide Vs. Protein Vs. Steroid</h3>'+
        '<div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">'+
        '<div style="padding:10px;background:var(--surface2);border-radius:9px;border-left:3px solid var(--teal);"><strong>Peptide</strong> - A Short Signal. Tells The Body To Do One Specific Thing, Gently And Briefly.</div>'+
        '<div style="padding:10px;background:var(--surface2);border-radius:9px;border-left:3px solid var(--blue-l);"><strong>Protein</strong> - A Long Chain That Does The Heavy Lifting (Like Muscle Or Enzymes). Same Blocks, Just Much Bigger.</div>'+
        '<div style="padding:10px;background:var(--surface2);border-radius:9px;border-left:3px solid var(--silver);"><strong>Steroid</strong> - A Completely Different Kind Of Molecule. Strong And Broad. Peptides Are Not Steroids - We Cover This In A Later Module.</div>'+
        '</div>')+
      checkCard('cq1','A Peptide Is Best Described As...',[['A Short Chemical Message Made Of Amino Acids',1],['A Type Of Anabolic Steroid',0],['A Vitamin Your Body Cannot Make',0]])+
      takeaways(['A Peptide Is A Short Chain Of 2-50 Amino Acids That Acts As A Signal.','It Carries One Instruction To One Target, Then Clears Out Fast.','Your Body Already Makes And Uses Peptides Every Day.','Peptides Are Not Steroids And Not The Same As Proteins.'])+
      note('Everything Here Is For Laboratory Research Education. Peptides Discussed In This Course Are Not Medicines Or Advice For People.');
    rebuild('s1',html);
  }

  /* ---------- MODULE 2: WHAT PEPTIDES DO IN THE BODY ---------- */
  function buildS2(){
    var teal='rgba(0,196,188,0.12)', blue='rgba(59,130,246,0.12)', sil='rgba(138,155,176,0.12)';
    var aa=[['Gly','Glycine'],['Ala','Alanine'],['Val','Valine'],['Leu','Leucine'],['Pro','Proline'],['Ser','Serine'],['Thr','Threonine'],['Cys','Cysteine'],['Met','Methionine'],['Phe','Phenylalanine'],['Trp','Tryptophan'],['His','Histidine']];
    var aabtns=aa.map(function(a){return '<button class="aa-btn" onclick="addAA(\''+a[0]+'\',\''+a[0][0]+'\')" aria-label="Add '+a[1]+'">'+a[0]+'</button>';}).join('');
    var html=
      '<div class="badge badge-teal">Module 2 - What They Do</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">What Peptides Do In The Body</h2>'+
      '<p style="margin-bottom:18px;">If Module 1 Was "What Is A Peptide," This Is "What Does It Actually Do." The Short Answer: Peptides Are Messengers. They Do Not Build Or Burn Anything Themselves - They Tell Your Body&#39;s Own Systems What To Do, And Your Body Does The Work.</p>'+
      card('<h3 style="font-size:16px;margin-bottom:14px;">Messengers, Not Materials</h3>'+
        '<div style="display:flex;flex-direction:column;gap:14px;">'+
        propRow(teal,ic('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>'),'They Carry One Instruction','A Peptide Does Not Do Many Things At Once. Each One Carries A Single, Specific Message - Like "Start Repair Here" Or "Release Growth Hormone Now."')+
        propRow(blue,ic('<path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/>'),'They Use Pathways You Already Have','Peptides Switch On Your Body&#39;s Existing Systems. That Is Why They Are Studied As Gentle, Targeted Signals Rather Than Brute-Force Drugs.')+
        propRow(sil,ic('<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/>'),'Their Effect Builds Over Time','Because A Single Peptide Message Is Brief, Research Protocols Repeat Them On A Schedule So The Signal Adds Up.')+
        '</div>')+
      card('<h3 style="font-size:16px;margin-bottom:6px;">How Long They Last (And Why It Matters)</h3>'+
        '<p style="font-size:13px;color:var(--silver);margin-bottom:12px;">A Peptide&#39;s Half-Life Decides How Often It Is Used. A Few Minutes Means Use It Often, Close To When You Want The Effect. A Few Days Means Once Or Twice A Week Is Enough.</p>'+
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:var(--surface2);"><th style="padding:9px 12px;text-align:left;">Peptide</th><th style="padding:9px 12px;text-align:left;">Half-Life</th><th style="padding:9px 12px;text-align:left;">Typical Use</th></tr></thead><tbody>'+
        [['Sermorelin','~10-20 Min','Right Before Sleep'],['BPC-157','~Hours','1-2x Daily'],['Ipamorelin','~2 Hours','Nightly'],['CJC-1295 (DAC)','~6-8 Days','1-2x Weekly']].map(function(r){return '<tr style="border-bottom:1px solid var(--border);"><td style="padding:9px 12px;font-weight:600;">'+r[0]+'</td><td style="padding:9px 12px;color:var(--teal);">'+r[1]+'</td><td style="padding:9px 12px;color:var(--silver);">'+r[2]+'</td></tr>';}).join('')+
        '</tbody></table></div>')+
      card('<h3 style="font-size:16px;margin-bottom:6px;">How Are They Taken?</h3>'+
        '<p style="font-size:13px;color:var(--silver);">Most Research Peptides Are Given As A Small Injection Just Under The Skin (Sub-Q). The Reason Is Simple: Your Stomach Treats A Swallowed Peptide Like Food And Digests It Before It Can Work. A Few Are Used As Nasal Sprays Or Creams Instead. We Cover This In Detail In A Later Module.</p>')+
      '<details class="opt-sci" style="margin-top:16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);overflow:hidden;">'+
        '<summary style="cursor:pointer;padding:14px 16px;font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;list-style:none;">'+ic('<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M1 12h4M19 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>')+'Optional: The Science Of How A Peptide Is Built <span style="color:var(--muted);font-weight:500;font-size:12px;">(For The Curious - Not Needed To Continue)</span></summary>'+
        '<div style="padding:0 16px 16px;">'+
          '<p style="font-size:13px;color:var(--silver);margin-bottom:12px;">A Peptide Is Just Building Blocks (Amino Acids) Linked In A Row. Tap The Buttons To Snap A Chain Together And Watch It Grow. The Short Line Between Each Pair Is The Bond That Holds Them Together.</p>'+
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><strong style="font-size:13px;">Your Peptide Chain</strong><button class="btn btn-ghost" style="padding:6px 12px;font-size:12px;min-height:36px;" onclick="clearChain()" aria-label="Clear Chain">Clear</button></div>'+
          '<div class="chain-area" id="chainArea" aria-live="polite" aria-label="Peptide Chain Builder"><span style="font-size:13px;color:var(--muted);">Add Building Blocks Below To Build Your Chain...</span></div>'+
          '<div id="chainInfo" style="font-size:13px;color:var(--muted);margin-bottom:12px;display:none;">Chain Length: <strong id="chainLen" style="color:var(--teal);">0</strong> Building Blocks <span id="chainType" style="margin-left:8px;"></span></div>'+
          '<div class="aa-grid" role="group" aria-label="Building Block Selection">'+aabtns+'</div>'+
          '<div class="callout" style="margin-top:12px;"><strong>The Peptide Bond:</strong> When Two Blocks Connect They Grab On Tight And A Tiny Drop Of Water Pops Out. That Grip Is Called A Peptide Bond - Strong Like Super Glue Between Two Bricks. Every Block In The Right Order Matters; Change One And The Peptide Can Stop Working.</div>'+
        '</div></details>'+
      checkCard('q2','What Is The Main Job Of A Peptide In The Body?',[['To Carry A Specific Signal That Tells Cells What To Do',1],['To Physically Build Muscle Tissue By Itself',0],['To Replace Vitamins And Minerals',0]])+
      takeaways(['Peptides Are Messengers - They Signal Your Body&#39;s Own Systems To Act.','Each Peptide Carries One Specific Instruction.','Half-Life Decides How Often A Peptide Is Used - Minutes Means Often, Days Means Weekly.','Most Are Injected Sub-Q Because The Stomach Would Digest Them.'])+
      note('Schedules And Examples Describe Laboratory Research, Not Instructions For People.');
    rebuild('s2',html);
    relabelRoadmap(2,'What Peptides Do');
    try{ if(typeof renderChain==='function') renderChain(); }catch(e){}
  }

  /* ---------- MODULE 3: THE LOCK AND KEY ---------- */
  function buildS3(){
    var teal='rgba(0,196,188,0.12)', blue='rgba(59,130,246,0.12)';
    var html=
      '<div class="badge badge-teal">Module 3 - How They Work</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">The Lock And Key</h2>'+
      '<p style="margin-bottom:18px;">Here Is The Single Most Important Idea For Understanding Every Peptide: They Work Like Keys. Your Cells Are Covered In Tiny Locks Called Receptors. A Peptide Only Does Something When Its Shape Fits One Of Those Locks. When The Right Key Slides In, The Lock Turns On And The Cell Springs Into Action.</p>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:16px;text-align:center;">Try It: Bind A Peptide To Its Receptor</h3>'+
        '<div class="lk-arena" id="lkArena">'+
          '<div><div class="lk-receptor" id="lkReceptor" aria-label="Receptor Site"><div style="text-align:center;padding:8px;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><div style="font-size:10px;margin-top:4px;">Receptor</div></div></div><div style="font-size:11px;color:var(--muted);text-align:center;margin-top:6px;">Cell Surface</div></div>'+
          '<div style="text-align:center;"><div style="font-size:12px;color:var(--muted);margin-bottom:8px;" id="lkInstr">Tap The Peptide To Try Binding</div><div class="lk-peptide" id="lkPeptide" onclick="bindPeptide()" role="button" tabindex="0" aria-label="Peptide - tap to bind" onkeydown="if(event.key===&#39;Enter&#39;||event.key===&#39; &#39;)bindPeptide()"><div style="text-align:center;font-size:9px;line-height:1.3;">BPC<br>157</div></div><div style="font-size:11px;color:var(--muted);margin-top:6px;">Peptide</div></div>'+
          '<div style="text-align:center;max-width:140px;"><div style="font-size:13px;color:var(--muted);" id="lkEffect">Tap The Peptide To See What Happens When It Binds</div></div>'+
        '</div>'+
        '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px;"><button class="btn btn-secondary" style="font-size:13px;padding:8px 16px;min-height:40px;" onclick="resetBinding()" aria-label="Reset Demo">Reset</button></div></div>'+
      card('<h3 style="font-size:15px;margin-bottom:12px;">What Happens After It Binds</h3>'+
        '<div style="display:flex;flex-direction:column;gap:8px;">'+
        ['The Peptide Key Slides Into Its Matching Lock.','The Lock Changes Shape And Switches On.','A Signal Travels Down Into The Cell.','The Cell Does Something New - Like Start Repairing Or Release A Hormone.'].map(function(t,i){return '<div style="display:flex;align-items:center;gap:11px;padding:9px;background:var(--surface2);border-radius:9px;"><div style="min-width:24px;height:24px;border-radius:50%;background:var(--teal);color:#001;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;">'+(i+1)+'</div><span style="font-size:13px;">'+t+'</span></div>';}).join('')+'</div>')+
      card('<h3 style="font-size:16px;margin-bottom:8px;">Why Shape Is Everything</h3>'+
        '<p style="font-size:13px;color:var(--silver);">A Peptide Does Not Work Because It Is Big, Small, Or A Certain Color. It Works Because Its Exact 3D Shape Fits One Exact Lock - And Nothing Else. This Is Why Peptides Are So Targeted: One Key, One Lock, One Job. It Is Also Why The Order Of The Building Blocks Matters So Much. Change The Order And You Change The Shape, And The Key No Longer Fits.</p>')+
      '<div class="grid2" style="margin-top:6px;">'+
        '<div class="card"><div style="display:flex;align-items:center;gap:10px;"><div style="min-width:34px;height:34px;border-radius:9px;background:'+teal+';display:flex;align-items:center;justify-content:center;">'+ic('<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>')+'</div><div><strong style="font-size:14px;">Keys That Turn It On</strong><p style="font-size:12px;color:var(--silver);margin-top:2px;">Most Studied Peptides Are "Agonists" - They Switch The Lock On, Like Ipamorelin Telling The Body To Release Growth Hormone.</p></div></div></div>'+
        '<div class="card"><div style="display:flex;align-items:center;gap:10px;"><div style="min-width:34px;height:34px;border-radius:9px;background:'+blue+';display:flex;align-items:center;justify-content:center;">'+ic('<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>')+'</div><div><strong style="font-size:14px;">Keys That Block It</strong><p style="font-size:12px;color:var(--silver);margin-top:2px;">Some Peptides Are "Antagonists" - They Sit In The Lock Without Turning It On, Blocking Other Signals From Getting In.</p></div></div></div>'+
      '</div>'+
      checkCard('q3','A Peptide Can Only Work If...',[['Its Shape Fits The Receptor (Lock)',1],['It Is Very Large',0],['It Is A Certain Color',0]])+
      takeaways(['Peptides Work Like Keys Fitting Locks Called Receptors.','Only A Matching Shape Activates A Lock - This Is Why Peptides Are So Targeted.','Binding Triggers A Signal That Tells The Cell To Act.','Order Of The Building Blocks Decides The Shape, So Order Matters.'])+
      note('The Binding Demo Is A Simplified Teaching Model Of A Real Biological Process.');
    rebuild('s3',html);
    try{ if(typeof resetBinding==='function') resetBinding(); }catch(e){}
  }

  /* ---------- MODULE 4: WHAT PEPTIDES ARE STUDIED FOR ---------- */
  function buildS4(){
    var teal='rgba(0,196,188,0.12)', blue='rgba(59,130,246,0.12)', sil='rgba(138,155,176,0.12)';
    var html=
      '<div class="badge badge-teal">Module 4 - Use Cases</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">What Peptides Are Studied For</h2>'+
      '<p style="margin-bottom:18px;">Now That You Know What Peptides Are And How They Work, Here Is Where The Interest Comes From: The Many Areas Researchers Study Them For. Each Area Below Has Specific Peptides Being Investigated. Remember - These Are Research Directions, Not Approved Treatments Or Promises.</p>'+
      useCard(teal,ic('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),'Healing And Recovery','Studied For Helping The Body Repair Muscle, Tendon, Ligament, And Gut Tissue Faster, And For Calming Inflammation.',['BPC-157','TB-500','GHK-Cu'])+
      useCard(blue,ic('<path d="M18 20V10M12 20V4M6 20v-6"/>'),'Growth And Muscle','Studied For Nudging The Body To Make More Of Its Own Growth Hormone, Which Affects Muscle, Recovery, And Body Composition.',['Sermorelin','CJC-1295','Ipamorelin'])+
      useCard(sil,ic('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),'Metabolism And Fat','Studied For How The Body Uses Energy And Burns Fat, Including The Newer Appetite-And-Weight Research Peptides.',['AOD-9604','MOTS-c','Tirzepatide'])+
      useCard(teal,ic('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),'Sleep And The Brain','Studied For Deeper Sleep, Focus, Calm, And Protecting Brain Cells. Sleep Is When A Lot Of The Body&#39;s Repair Happens.',['DSIP','Selank','Semax'])+
      useCard(blue,ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),'Skin And Anti-Aging','Studied For Collagen, Skin Repair, Hair, And Markers Of Aging At The Cellular Level.',['GHK-Cu','Epithalon','SNAP-8'])+
      useCard(sil,ic('<path d="M9 12l2 2 4-4"/><path d="M12 3a9 9 0 1 0 9 9"/>'),'Immune Support','Studied For Tuning And Strengthening The Immune System, Especially In Aging Or Chronic-Infection Research.',['Thymosin Alpha-1','Thymalin','LL-37'])+
      '<div class="callout callout-red" style="margin-top:6px;"><strong style="color:var(--red);">These Are Research Areas, Not Promises:</strong> A Peptide Being "Studied For" Something Does Not Mean It Is Proven Or Approved. It Means Scientists Are Investigating It. Always Treat These As Early Research.</div>'+
      checkCard('q4','Which Peptide Is Most Associated With Growth Hormone Release?',[['Ipamorelin',1],['BPC-157',0],['TB-500',0]])+
      takeaways(['Peptides Are Studied Across Recovery, Growth, Metabolism, Sleep, Skin, And Immunity.','Each Research Area Has Its Own Specific Peptides.','"Studied For" Means Under Investigation - Not Proven Or Approved.','You Can Explore Every Compound In The Peptide Explorer.'])+
      note('None Of The Compounds Named Here Are Approved Medicines. This Is Research Education Only.');
    rebuild('s4',html);
  }

  /* ---------- MODULE 5: HANDLING AND STORAGE ---------- */
  function buildS5(){
    var hlBtns=[['BPC-157',4,'#00C4BC'],['TB-500',72,'#3B82F6'],['Sermorelin',0.25,'#D0DAE4'],['Ipamorelin',2,'#8A9BB0'],['CJC-1295 (DAC)',192,'#60A5FA']]
      .map(function(b){return '<button class="btn btn-secondary" style="font-size:13px;padding:8px 14px;min-height:40px;" onclick="showHL(\''+b[0]+'\','+b[1]+',\''+b[2]+'\')" aria-label="Show '+b[0]+' half-life">'+b[0]+'</button>';}).join('');
    function srow(stroke,title,body){return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:var(--surface2);border-radius:10px;">'+ic('<circle cx="12" cy="12" r="9"/>').replace('stroke="currentColor"','stroke="'+stroke+'"')+'<div><strong style="font-size:13px;">'+title+'</strong><p style="font-size:12px;margin-top:2px;color:var(--silver);">'+body+'</p></div></div>';}
    var html=
      '<div class="badge badge-teal">Module 5 - Handling And Storage</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">Handling And Storage</h2>'+
      '<p style="margin-bottom:18px;">Peptides Are Fragile, A Bit Like A Snowflake. Heat, Light, Moisture, And Freezing Them Over And Over Can Break Them Down So They No Longer Work. The Good News: Keeping Them Safe Is Simple Once You Know The Rules. A Mishandled Peptide Is Just A Wasted One.</p>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:6px;">Half-Life Explorer</h3>'+
        '<p style="font-size:13px;color:var(--muted);margin-bottom:14px;">Tap A Peptide To See How Long It Stays Active In The Body Before It Breaks Down:</p>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">'+hlBtns+'</div>'+
        '<div id="hlResult" style="display:none;"><div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;"><strong id="hlName"></strong><span id="hlTime" style="color:var(--teal);font-weight:700;"></span></div><div class="hl-bar-wrap"><div class="hl-bar" id="hlBar" style="width:0%;"></div></div><p id="hlNote" style="font-size:12px;margin-top:8px;color:var(--silver);"></p></div></div>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:14px;">Storage Guide</h3>'+
        '<div class="tabs" role="tablist" aria-label="Storage Tabs">'+
        '<button class="tab active" onclick="switchTab(\'dry\')" role="tab" aria-selected="true" aria-controls="tab-dry" id="tab-btn-dry">Dry Powder</button>'+
        '<button class="tab" onclick="switchTab(\'recon\')" role="tab" aria-selected="false" aria-controls="tab-recon" id="tab-btn-recon">After Mixing With Water</button></div>'+
        '<div class="tab-panel active" id="tab-dry" role="tabpanel" aria-labelledby="tab-btn-dry"><div style="display:flex;flex-direction:column;gap:10px;">'+
          srow('var(--teal)','Temperature: Keep It Cold','Dry Peptide Powder Lasts 3-6 Months In The Fridge. Need Longer? The Freezer Keeps It Good For A Year Or More.')+
          srow('var(--teal)','Light: Keep It Dark','Bright Light Slowly Breaks Peptides Apart. Store Them In Their Original Dark Vial, Out Of The Light.')+
          srow('var(--teal)','Moisture: Keep It Dry','As Long As The Powder Stays Dry And Sealed, It Stays Stable. Do Not Open It In Steamy, Humid Air.')+
          srow('var(--blue-l)','Freeze-Thaw: Do Not Repeat','Freezing And Thawing Over And Over Damages Peptides. Split Into Small Portions So You Never Thaw The Same Batch Twice.')+
        '</div></div>'+
        '<div class="tab-panel" id="tab-recon" role="tabpanel" aria-labelledby="tab-btn-recon"><div class="callout callout-red" style="margin-bottom:14px;"><strong style="color:var(--red);">Important:</strong> Once You Add Water, A Peptide Becomes Much More Fragile. Liquid Peptides Do Not Last Nearly As Long As Dry Powder.</div><div style="display:flex;flex-direction:column;gap:10px;">'+
          srow('var(--teal)','Temperature: Fridge Always','Liquid Peptides Must Stay In The Fridge (36-46F). Do Not Leave Them Out For More Than About Half An Hour.')+
          srow('var(--teal)','Use Window: About 4 Weeks','Mixed With Bacteriostatic (BAC) Water, A Liquid Peptide Lasts Roughly 28-30 Days. With Plain Sterile Water, Only A Day Or Two.')+
          srow('var(--red)','Do Not Freeze The Liquid','Freezing A Liquid Peptide Forms Sharp Ice Crystals That Tear It Apart. For Long Storage, Keep It As Dry Powder.')+
        '</div></div></div>'+
      '<div class="callout"><strong>BAC Water Vs. Sterile Water:</strong> Bacteriostatic Water Has A Tiny Bit Of Alcohol In It That Stops Germs From Growing. That Is Why It Keeps Peptides Good For About 4 Weeks, While Plain Water Only Lasts A Day Or Two.</div>'+
      '<div class="card" id="shelfLink"><div style="display:flex;align-items:flex-start;gap:12px;"><div style="min-width:40px;height:40px;border-radius:10px;background:rgba(0,196,188,0.12);display:flex;align-items:center;justify-content:center;">'+ic('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',20).replace('stroke="currentColor"','stroke="var(--teal)"')+'</div><div style="flex:1;"><strong style="font-size:14px;">Track Your Reconstituted Vials</strong><p style="font-size:13px;color:var(--muted);margin:4px 0 10px;">Once You Add Water, Log The Date And Let The Tracker Tell You The Discard Date For Each Vial.</p><a class="btn btn-secondary" href="/shelf-life" style="font-size:13px;">Open The Shelf-Life Tracker'+ic('<path d="M5 12h14M12 5l7 7-7 7"/>',16)+'</a></div></div></div>'+
      checkCard('cq5','Once A Peptide Is Mixed With Water, It Should Be...',[['Kept Cold In The Fridge And Used Within Weeks',1],['Left At Room Temperature Indefinitely',0],['Frozen And Thawed Whenever Needed',0]])+
      takeaways(['Heat, Light, Moisture, And Freeze-Thaw All Break Peptides Down.','Dry Powder Lasts Months In The Fridge; Liquid Lasts Weeks.','BAC Water Beats Plain Sterile Water For Shelf Life.','Never Re-Freeze A Reconstituted (Liquid) Peptide.'])+
      note('Storage Guidance Is For Handling Research Materials In A Lab Setting.');
    rebuild('s5',html);
  }

  /* ---------- INIT ---------- */
  function ready(){ return !!(document.getElementById('s1') && document.getElementById('s2') && qs('.course-nav-wrap')); }
  function init(){
    if(window.__p101v7) return; window.__p101v7=1;
    try{ lockHeader(); }catch(e){}
    try{ buildS1(); }catch(e){}
    try{ buildS2(); }catch(e){}
    try{ buildS3(); }catch(e){}
    try{ buildS4(); }catch(e){}
    try{ buildS5(); }catch(e){}
    try{ lockHeader(); }catch(e){}
  }
  function boot(){ if(ready()){init();return;} var n=0,t=setInterval(function(){ if(ready()||n++>100){clearInterval(t);init();} },40); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,60);});
  else setTimeout(boot,60);
})();
