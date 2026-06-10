/* Peptide 101 - Module 7: Stacking And Research Protocols (paginated, v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['What Is Stacking','Why Stack','Common Stacks','Two Locks','Quick Check'];
    function stackCard(a,b,title,tag,body){
      return '<div class="v14-card"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;"><h4 style="margin:0;">'+title+'</h4><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#9fb0c2;background:#16263f;border-radius:999px;padding:3px 9px;">'+tag+'</span></div>'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
        + '<span style="flex:1;text-align:center;font-weight:700;color:#2de0d8;background:rgba(0,196,188,.12);border:1px solid rgba(0,196,188,.3);border-radius:10px;padding:9px;">'+a+'</span>'
        + '<span style="color:#7fb3ff;font-size:20px;font-weight:300;">+</span>'
        + '<span style="flex:1;text-align:center;font-weight:700;color:#7fb3ff;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3);border-radius:10px;padding:9px;">'+b+'</span></div>'
        + '<p>'+body+'</p></div>';
    }

    var P1 = H.eyebrow(7,1,5)
      + '<h1 class="v14-h">Stacking And Research Protocols</h1>'
      + '<p class="v14-lead">Stacking means using more than one peptide at the same time. Like mixing LEGO colors, each one does a different job, and together they can do more.</p>'
      + '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 190" xmlns="http://www.w3.org/2000/svg">'
        + '<ellipse cx="310" cy="170" rx="220" ry="12" fill="#05101f" opacity="0.5"/>'
        + '<g class="v14-float"><line x1="120" y1="70" x2="220" y2="70" stroke="url(#v14bond)" stroke-width="8" stroke-linecap="round"/>'
        + ['120','170','220'].map(function(x){return '<g filter="url(#v14sh)"><circle cx="'+x+'" cy="70" r="20" fill="url(#v14beadT)"/></g>';}).join('')
        + '<line x1="400" y1="110" x2="500" y2="110" stroke="url(#v14bond)" stroke-width="8" stroke-linecap="round"/>'
        + ['400','450','500'].map(function(x){return '<g filter="url(#v14sh)"><circle cx="'+x+'" cy="110" r="20" fill="url(#v14bead)"/></g>';}).join('')
        + '</g>'
        + '<text x="310" y="160" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Two Peptides, Working Together</text>'
        + '</svg></div>';

    var P2 = H.eyebrow(7,2,5)
      + '<h1 class="v14-h">Why Researchers Stack</h1>'
      + '<p class="v14-lead">There are three main reasons to use two peptides together.</p>'
      + '<div class="v14-cards c3">'
        + H.iconCard('M5 12h6M11 12l-3-3M11 12l-3 3M13 12h6M13 12l3-3M13 12l3 3','Complementary Pathways','Two peptides push the same goal through two different doors at once, for a bigger result than either alone.')
        + H.iconCard('M3 12h18M12 3v18','Sequential Mechanisms','One works right where you put it, while another travels the whole body. Together they cover the spot and the system.')
        + H.iconCard('M12 8v4l3 2M12 3a9 9 0 1 0 9 9','Timing Optimization','Some are quick and used before sleep, others last for days. Timing them right makes a difference.')
      + '</div>';

    var P3 = H.eyebrow(7,3,5)
      + '<h1 class="v14-h">Common Research Stacks</h1>'
      + '<p class="v14-lead">Two stacks come up again and again in the research.</p>'
      + stackCard('CJC-1295 DAC','Ipamorelin','GH Axis Protocol','Most Common','One peptide is used once or twice a week. The other is used each night before sleep. Together they boost the body natural nighttime growth signals.')
      + stackCard('BPC-157','TB-500','Tissue Research Protocol','Targeted','One peptide works right at the sore spot. The other spreads through the whole body. Together they cover both the spot and everything around it.');

    var P4 = H.eyebrow(7,4,5)
      + '<h1 class="v14-h">Two Locks, One Result</h1>'
      + '<p class="v14-lead">When two peptides open two different locks toward the same goal, the result is bigger than either one alone.</p>'
      + '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 190" xmlns="http://www.w3.org/2000/svg">'
        + '<g filter="url(#v14sh)"><rect x="70" y="50" width="50" height="50" rx="12" fill="#0f2a25" stroke="#2de0d8" stroke-width="2"/></g>'
        + '<g filter="url(#v14sh)"><rect x="70" y="110" width="50" height="50" rx="12" fill="#13233c" stroke="#5ea0ff" stroke-width="2"/></g>'
        + '<path d="M130 75 Q260 75 300 100" fill="none" stroke="#2de0d8" stroke-width="4" stroke-linecap="round"/>'
        + '<path d="M130 135 Q260 135 300 110" fill="none" stroke="#5ea0ff" stroke-width="4" stroke-linecap="round"/>'
        + '<g class="v14-pulse" filter="url(#v14sh)"><circle cx="350" cy="105" r="40" fill="url(#v14beadT)"/></g>'
        + '<text x="350" y="110" fill="#04201d" font-size="13" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">Bigger</text>'
        + '<text x="350" y="170" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Two Different Locks, One Bigger Result</text>'
        + '</svg></div>'
      + '<div class="v14-bridge" style="box-shadow:0 8px 22px rgba(0,0,0,.45),inset 4px 0 0 #E53E3E;"><svg viewBox="0 0 24 24" fill="none" stroke="#E53E3E" stroke-width="2"><path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/></svg><p><b>Research context only:</b> everything here describes what scientists do in labs and studies. None of it is approved medicine or advice.</p></div>';

    var P5 = H.eyebrow(7,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 8.</p>'
      + '<div class="v14-q" id="m7q1"><div class="qn">Question 1 Of 2</div><div class="qt">What does stacking mean?</div>'
        + H.opt('Using one peptide twice',0) + H.opt('Using more than one peptide together',1) + H.opt('Freezing peptides',0)
        + '<div class="v14-fb">Correct. Stacking is using more than one peptide at the same time.</div></div>'
      + '<div class="v14-q" id="m7q2"><div class="qn">Question 2 Of 2</div><div class="qt">The most common research stack pairs CJC-1295 with...</div>'
        + H.opt('BPC-157',0) + H.opt('Ipamorelin',1) + H.opt('Selank',0)
        + '<div class="v14-fb">Right. CJC-1295 and Ipamorelin are the most common GH Axis stack.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('Stacking means using more than one peptide together.')
        + H.recap('Researchers stack for complementary pathways, coverage, and timing.')
        + H.recap('CJC-1295 + Ipamorelin and BPC-157 + TB-500 are common stacks.')
        + H.recap('Everything here is research context, not medical advice.')
      + '</ul></div>';

    H.module('s7', 7, 6, 8, labels, function(){ return [P1,P2,P3,P4,P5]; });
  }
  start();
})();
