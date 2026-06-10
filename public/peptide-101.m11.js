/* Peptide 101 - Module 11: Why Peptides Are Injected (screen s12, paginated v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['The Question','The Shredder','Skip The Gut','Connects Back','Quick Check'];

    var P1 = H.eyebrow(11,1,5)
      + '<h1 class="v14-h">Why Peptides Are Injected, Not Swallowed</h1>'
      + '<p class="v14-lead">Ever wonder why you do not just take a peptide as a pill? The answer is sitting in your stomach right now.</p>'
      + '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 160" xmlns="http://www.w3.org/2000/svg">'
        + '<g filter="url(#v14sh)"><circle cx="160" cy="68" r="46" fill="#2a1414" stroke="#E53E3E" stroke-width="2"/></g>'
        + '<path d="M144 52l32 32M176 52l-32 32" fill="none" stroke="#E53E3E" stroke-width="3" stroke-linecap="round"/>'
        + '<text x="160" y="132" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Swallowed: Destroyed</text>'
        + '<g filter="url(#v14sh)"><circle cx="460" cy="68" r="46" fill="#0f2a25" stroke="#2de0d8" stroke-width="2"/></g>'
        + '<path d="M440 68l14 14 26-28" fill="none" stroke="#2de0d8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<text x="460" y="132" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Injected: Survives</text>'
        + '</svg></div>';

    var P2 = H.eyebrow(11,2,5)
      + '<h1 class="v14-h">Your Stomach Is A Shredder</h1>'
      + '<p class="v14-lead">The stomach is built to take chains apart, and a peptide is exactly that kind of chain.</p>'
      + '<div class="v14-card"><div class="v14-ic">'+H.ic('M6 3h12l-1 7a5 5 0 0 1-10 0z M9 14v3a3 3 0 0 0 6 0')+'</div><h4>It Snaps The Same Bonds</h4><p>Your stomach breaks food apart by snapping the exact same bonds that hold a peptide together. So if you swallowed a peptide, your body would treat it like lunch and digest it before it could do anything.</p></div>';

    var P3 = H.eyebrow(11,3,5)
      + '<h1 class="v14-h">Injection Skips The Gut</h1>'
      + '<p class="v14-lead">There is a simple way around the shredder.</p>'
      + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #2de0d8;"><div class="v14-ic">'+H.ic('M12 2a7 7 0 0 0-7 7c0 3 7 13 7 13s7-10 7-13a7 7 0 0 0-7-7z')+'</div><h4 style="color:#2de0d8;">Straight Past The Stomach</h4><p>A small injection just under the skin puts the peptide straight into the body, past the stomach. That is why almost every research peptide is used as an injection instead of a pill.</p></div>';

    var P4 = H.eyebrow(11,4,5)
      + '<h1 class="v14-h">It All Connects</h1>'
      + '<p class="v14-lead">This ties back to something you already learned about peptides.</p>'
      + '<div class="v14-bridge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/></svg><p><b>Connects back:</b> this is the same reason peptides do not last long. The body is very good at breaking them down, inside or out.</p></div>'
      + '<div class="v14-card"><div class="v14-ic">'+H.ic('M12 8v4l3 2M12 3a9 9 0 1 0 9 9')+'</div><h4>Same Fragility, Two Places</h4><p>Whether in the gut or in a mixed vial left out too long, a peptide is delicate. Handle it gently and get it past the stomach, and it can do its job.</p></div>';

    var P5 = H.eyebrow(11,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 12.</p>'
      + '<div class="v14-q" id="m11q1"><div class="qn">Question 1 Of 2</div><div class="qt">Why are most peptides injected instead of swallowed?</div>'
        + H.opt('They Taste Bad',0) + H.opt('The Stomach Digests Them',1) + H.opt('They Are Too Big To Swallow',0)
        + '<div class="v14-fb">Correct. The stomach would digest a swallowed peptide before it could work.</div></div>'
      + '<div class="v14-q" id="m11q2"><div class="qn">Question 2 Of 2</div><div class="qt">A small injection under the skin works because it...</div>'
        + H.opt('Makes the peptide stronger',0) + H.opt('Puts the peptide past the stomach',1) + H.opt('Tastes better',0)
        + '<div class="v14-fb">Right. Injecting skips the stomach entirely, so the peptide survives.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('The stomach snaps the same bonds that hold a peptide together.')
        + H.recap('A swallowed peptide gets digested like food.')
        + H.recap('Injecting under the skin skips the stomach.')
        + H.recap('The same fragility is why mixed peptides do not last long.')
      + '</ul></div>';

    H.module('s12', 11, 11, 13, labels, function(){ return [P1,P2,P3,P4,P5]; }, {nextLabel:'Module 12'});
  }
  start();
})();
