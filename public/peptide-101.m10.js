/* Peptide 101 - Module 10: What Peptides Are NOT (screen s11, paginated v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['Three Myths','Not Steroids','Not Medicine','Remember It','Quick Check'];

    var P1 = H.eyebrow(10,1,5)
      + '<h1 class="v14-h">What Peptides Are NOT</h1>'
      + '<p class="v14-lead">Before going further, let us clear up the three biggest myths. Knowing what peptides are NOT is as important as knowing what they are.</p>'
      + '<div class="v14-cards c3">'
        + H.iconCard('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM5.6 5.6l12.8 12.8','Not Steroids','Steroids force a big change. Peptides are gentle signals.','#2de0d8')
        + H.iconCard('M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11','Not Medicines','They have not passed years of trials. They are studied in labs.','#7fb3ff')
        + H.iconCard('M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21l2.3-7.4-6-4.6h7.6z','Not Magic','They do not work instantly or for everyone.','#a78bfa')
      + '</div>'
      + '<div class="v14-bridge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg><p><b>Why this matters:</b> clearing up what peptides are NOT prevents the most common, and riskiest, mistakes.</p></div>';

    var P2 = H.eyebrow(10,2,5)
      + '<h1 class="v14-h">Not Steroids</h1>'
      + '<p class="v14-lead">This is the most common mix-up, and the most important one to get right.</p>'
      + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #2de0d8;"><div class="v14-ic">'+H.ic('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM5.6 5.6l12.8 12.8')+'</div><h4 style="color:#2de0d8;">A Gentle Signal, Not A Force</h4><p>Steroids are powerful hormones that force a big change. Peptides are gentle signals that ask the body to do something it already knows how to do.</p></div>'
      + '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 150" xmlns="http://www.w3.org/2000/svg">'
        + '<g filter="url(#v14sh)"><circle cx="160" cy="70" r="44" fill="#0f2a25" stroke="#2de0d8" stroke-width="2"/></g>'
        + '<path d="M140 70h40M170 60l10 10-10 10" fill="none" stroke="#2de0d8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<text x="160" y="132" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Peptide: A Quiet Text Message</text>'
        + '<g filter="url(#v14sh)"><circle cx="460" cy="70" r="44" fill="#2a1414" stroke="#E53E3E" stroke-width="2"/></g>'
        + '<path d="M444 58l12 12-12 12M476 58l-12 12 12 12" fill="none" stroke="#E53E3E" stroke-width="3" stroke-linecap="round"/>'
        + '<text x="460" y="132" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Steroid: Shouting Through A Megaphone</text>'
        + '</svg></div>';

    var P3 = H.eyebrow(10,3,5)
      + '<h1 class="v14-h">Not Medicine, Not Magic</h1>'
      + '<p class="v14-lead">Two more myths to put to rest.</p>'
      + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #7fb3ff;"><div class="v14-ic">'+H.ic('M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11')+'</div><h4 style="color:#7fb3ff;">Not Approved Medicines</h4><p>A medicine has passed years of trials and is approved to treat people. Research peptides have not, they are studied in labs.</p></div>'
      + '<div class="v14-card"><div class="v14-ic">'+H.ic('M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21l2.3-7.4-6-4.6h7.6z')+'</div><h4>Not Magic</h4><p>They do not work instantly or for everyone. They are one small signal among thousands, and their effects are still being researched.</p></div>';

    var P4 = H.eyebrow(10,4,5)
      + '<h1 class="v14-h">A Simple Way To Remember It</h1>'
      + '<p class="v14-lead">One picture ties all three myths together.</p>'
      + '<div class="v14-card"><p style="font-size:14.5px;line-height:1.7;color:#dbe6f2;">A peptide is like a short text message to your cells. A steroid is like someone shouting through a megaphone. A medicine is a message that has been tested and approved. A peptide in research is a message scientists are still reading.</p></div>';

    var P5 = H.eyebrow(10,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 11.</p>'
      + '<div class="v14-q" id="m10q1"><div class="qn">Question 1 Of 2</div><div class="qt">Which statement is TRUE about peptides?</div>'
        + H.opt('They Are Anabolic Steroids',0) + H.opt('They Are Approved Medicines',0) + H.opt('They Are Signaling Molecules',1)
        + '<div class="v14-fb">Correct. Peptides are signaling molecules, gentle messages, not steroids or approved medicines.</div></div>'
      + '<div class="v14-q" id="m10q2"><div class="qn">Question 2 Of 2</div><div class="qt">How is a peptide different from a steroid?</div>'
        + H.opt('A peptide forces a big change',0) + H.opt('A peptide is a gentle signal, a steroid forces a big change',1) + H.opt('They are the same thing',0)
        + '<div class="v14-fb">Right. A peptide asks gently, a steroid forces.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('Peptides are gentle signals, not powerful steroids.')
        + H.recap('Research peptides are not approved medicines.')
        + H.recap('They are not magic and do not work instantly or for everyone.')
        + H.recap('Think of a peptide as a short text message to your cells.')
      + '</ul></div>';

    H.module('s11', 10, 9, 12, labels, function(){ return [P1,P2,P3,P4,P5]; }, {nextLabel:'Module 11'});
  }
  start();
})();
