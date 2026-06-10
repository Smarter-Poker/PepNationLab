/* Peptide 101 - Module 2: Building A Peptide (paginated, v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['Linking Blocks','The Peptide Bond','Order Matters','How Big?','Quick Check'];

    function bondViz(){
      return '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 200" xmlns="http://www.w3.org/2000/svg">'
        + '<ellipse cx="310" cy="178" rx="250" ry="12" fill="#05101f" opacity="0.5"/>'
        + '<g filter="url(#v14sh)"><circle cx="86" cy="92" r="25" fill="url(#v14bead)"/><ellipse cx="79" cy="84" rx="8" ry="5" fill="#fff" opacity="0.55"/></g>'
        + '<g filter="url(#v14sh)"><circle cx="162" cy="92" r="25" fill="url(#v14beadT)"/><ellipse cx="155" cy="84" rx="8" ry="5" fill="#fff" opacity="0.55"/></g>'
        + '<text x="124" y="148" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Two Amino Acids</text>'
        + '<path d="M250 92 h62" stroke="#5ea0ff" stroke-width="4" stroke-linecap="round"/><path d="M306 83 l12 9 -12 9" fill="none" stroke="#5ea0ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<line x1="430" y1="92" x2="500" y2="92" stroke="url(#v14bond)" stroke-width="10" stroke-linecap="round"/>'
        + '<g filter="url(#v14sh)"><circle cx="430" cy="92" r="25" fill="url(#v14bead)"/><ellipse cx="423" cy="84" rx="8" ry="5" fill="#fff" opacity="0.55"/></g>'
        + '<g filter="url(#v14sh)"><circle cx="500" cy="92" r="25" fill="url(#v14beadT)"/><ellipse cx="493" cy="84" rx="8" ry="5" fill="#fff" opacity="0.55"/></g>'
        + '<g class="v14-float"><circle cx="465" cy="38" r="12" fill="#2de0d8" opacity="0.9" filter="url(#v14sh)"/><text x="465" y="42" fill="#04201d" font-size="9" text-anchor="middle" font-weight="700" font-family="Inter,sans-serif">H2O</text></g>'
        + '<text x="465" y="148" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Joined By A Peptide Bond</text>'
        + '</svg></div>';
    }
    function bondZoom(){
      return '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 200" xmlns="http://www.w3.org/2000/svg">'
        + '<ellipse cx="310" cy="180" rx="180" ry="12" fill="#05101f" opacity="0.5"/>'
        + '<line x1="232" y1="96" x2="388" y2="96" stroke="url(#v14bond)" stroke-width="16" stroke-linecap="round"/>'
        + '<rect x="296" y="74" width="28" height="44" rx="9" fill="#0a1322" stroke="#5ea0ff" stroke-width="2" class="v14-pulse"/>'
        + '<g filter="url(#v14sh)"><circle cx="232" cy="96" r="44" fill="url(#v14bead)"/><ellipse cx="218" cy="80" rx="13" ry="8" fill="#fff" opacity="0.5"/></g>'
        + '<g filter="url(#v14sh)"><circle cx="388" cy="96" r="44" fill="url(#v14beadT)"/><ellipse cx="374" cy="80" rx="13" ry="8" fill="#fff" opacity="0.5"/></g>'
        + '<text x="310" y="160" fill="#7fb3ff" font-size="13" text-anchor="middle" font-weight="700" font-family="Inter,sans-serif">The Peptide Bond</text>'
        + '</svg></div>';
    }

    var P1 = H.eyebrow(2,1,5)
      + '<h1 class="v14-h">Building A Peptide</h1>'
      + '<p class="v14-lead">A peptide is just building blocks holding hands in a row. When two blocks link up, a tiny drop of water pops out. That is how the chain grows, one link at a time.</p>'
      + bondViz()
      + '<div class="v14-bridge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg><p><b>Plain version:</b> snap two blocks together, a drop of water leaves, and they are now locked in a chain.</p></div>';

    var P2 = H.eyebrow(2,2,5)
      + '<h1 class="v14-h">The Peptide Bond</h1>'
      + '<p class="v14-lead">That link between two blocks has a name. It is called a <b>peptide bond</b>.</p>'
      + bondZoom()
      + '<div class="v14-card"><div class="v14-ic">'+H.ic('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z')+'</div><h4>Like Super Glue Between LEGO Bricks</h4><p>Once two blocks lock together with a peptide bond, they are very hard to pull apart. That is what holds every peptide in one piece.</p></div>';

    var P3 = H.eyebrow(2,3,5)
      + '<h1 class="v14-h">Order Matters</h1>'
      + '<p class="v14-lead">Same blocks in a <b>different order</b> make a completely different peptide. The order is the recipe.</p>'
      + '<div class="v14-stage-frame">'+H.beadChain(7,true)+'</div>'
      + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #00C4BC;"><h4 style="color:#2de0d8;">BPC-157 Example</h4><p>BPC-157 is 15 blocks linked in one exact order. Every single link matters. Swap or remove one and it stops working.</p></div>';

    var P4 = H.eyebrow(2,4,5)
      + '<h1 class="v14-h">How Big Is A Peptide?</h1>'
      + '<p class="v14-lead">Peptides are short. Proteins can be hundreds of blocks long. Here is how a few line up by length.</p>'
      + H.barChart([
          {label:'GHK-Cu', value:3, color:'#00C4BC'},
          {label:'Oxytocin', value:9, color:'#2de0d8'},
          {label:'BPC-157', value:15, color:'#3B82F6'},
          {label:'Sermorelin', value:29, color:'#5ea0ff'},
          {label:'Albumin (A Protein)', value:585, color:'#7fb3ff'}
        ], 585, 'blocks')
      + '<p class="v14-lead" style="font-size:14px;color:#aebccb;margin:0;">The research peptides in this course sit on the small end. That small size is part of why they move through the body so easily.</p>';

    var P5 = H.eyebrow(2,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 3.</p>'
      + '<div class="v14-q" id="m2q1"><div class="qn">Question 1 Of 2</div><div class="qt">When two amino acids link, what leaves?</div>'
        + H.opt('A spark',0) + H.opt('A tiny drop of water',1) + H.opt('Nothing',0)
        + '<div class="v14-fb">Correct. A tiny drop of water pops out each time a new peptide bond forms.</div></div>'
      + '<div class="v14-q" id="m2q2"><div class="qn">Question 2 Of 2</div><div class="qt">Two peptides with the same blocks in a different order are...</div>'
        + H.opt('Identical',0) + H.opt('Different peptides',1) + H.opt('Always proteins',0)
        + '<div class="v14-fb">Right. The order is the recipe, so a different order means a different peptide.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('Blocks join into a chain through peptide bonds.')
        + H.recap('Each new link releases a tiny drop of water.')
        + H.recap('The order of the blocks decides what the peptide does.')
        + H.recap('Peptides are short chains. Proteins are much longer.')
      + '</ul></div>';

    H.module('s2', 2, 1, 3, labels, function(){ return [P1,P2,P3,P4,P5]; });
  }
  start();
})();
