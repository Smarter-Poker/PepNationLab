/* Peptide 101 - Module 3: The Lock And Key (paginated, v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['Lock And Key','The Receptor','After It Binds','One Key One Lock','Quick Check'];

    function lockKey(){
      return '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 210" xmlns="http://www.w3.org/2000/svg">'
        + '<ellipse cx="310" cy="190" rx="250" ry="13" fill="#05101f" opacity="0.5"/>'
        + '<g class="v14-float" filter="url(#v14sh)">'
        + '<rect x="150" y="98" width="170" height="18" rx="6" fill="url(#v14bond)"/>'
        + '<rect x="296" y="116" width="13" height="26" rx="3" fill="url(#v14bond)"/>'
        + '<rect x="270" y="116" width="11" height="18" rx="3" fill="url(#v14bond)"/>'
        + '<circle cx="120" cy="107" r="42" fill="url(#v14beadT)"/><ellipse cx="106" cy="92" rx="12" ry="7" fill="#fff" opacity="0.5"/>'
        + '</g>'
        + '<g filter="url(#v14sh)"><rect x="360" y="66" width="170" height="124" rx="20" fill="#13233c" stroke="#5ea0ff" stroke-width="2"/>'
        + '<path d="M392 66 v-10 a53 53 0 0 1 106 0 v10" fill="none" stroke="#9fc4ff" stroke-width="11" stroke-linecap="round"/>'
        + '<circle cx="445" cy="120" r="18" fill="#0a1322" stroke="#7fb3ff" stroke-width="2" class="v14-pulse"/>'
        + '<rect x="439" y="128" width="12" height="30" rx="4" fill="#0a1322"/></g>'
        + '<text x="120" y="180" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Peptide (Key)</text>'
        + '<text x="445" y="180" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Receptor (Lock)</text>'
        + '</svg></div>';
    }
    function cascade(){
      var steps=[['1','The Key Slides Into Its Matching Lock'],['2','The Lock Changes Shape And Opens'],['3','A Signal Travels Inside The Cell'],['4','The Cell Does Something New']];
      return '<div class="v14-stage-frame" style="padding:20px;">'+steps.map(function(s,i){
        return '<div style="display:flex;align-items:center;gap:14px;'+(i<steps.length-1?'margin-bottom:10px;':'')+'">'
          + '<div style="width:34px;height:34px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:14px;color:#0a1322;background:linear-gradient(180deg,#7fe0cf,#15b8ad);box-shadow:0 0 12px rgba(0,196,188,.5);">'+s[0]+'</div>'
          + '<div style="font-size:14px;color:#e7eef6;font-weight:500;">'+s[1]+'</div></div>';
      }).join('')+'</div>';
    }

    var P1 = H.eyebrow(3,1,5)
      + '<h1 class="v14-h">The Lock And Key</h1>'
      + '<p class="v14-lead">Peptides work like keys. Your cells are covered in tiny locks. Each peptide is shaped to fit <b>one special lock</b>, and nothing else.</p>'
      + lockKey()
      + '<div class="v14-bridge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg><p><b>In one line:</b> the right key slides into the right lock, the door opens, and the cell gets the message.</p></div>';

    var P2 = H.eyebrow(3,2,5)
      + '<h1 class="v14-h">The Receptor</h1>'
      + '<p class="v14-lead">Scientists call the lock a <b>receptor</b>. It sits on the surface of a cell, waiting for the one key that fits it.</p>'
      + '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 180" xmlns="http://www.w3.org/2000/svg">'
        + '<path d="M20 130 Q160 90 310 120 Q460 150 600 110 L600 180 L20 180 Z" fill="rgba(59,130,246,.10)" stroke="rgba(127,179,255,.35)" stroke-width="2"/>'
        + '<g filter="url(#v14sh)"><rect x="120" y="92" width="40" height="44" rx="10" fill="#16263f" stroke="#5ea0ff" stroke-width="2"/><circle cx="140" cy="110" r="8" fill="#0a1322"/></g>'
        + '<g filter="url(#v14sh)"><rect x="290" y="100" width="40" height="44" rx="10" fill="#0f2a25" stroke="#2de0d8" stroke-width="2.5"/><circle cx="310" cy="118" r="8" fill="#0a1322"/></g>'
        + '<g filter="url(#v14sh)"><rect x="450" y="86" width="40" height="44" rx="10" fill="#16263f" stroke="#5ea0ff" stroke-width="2"/><circle cx="470" cy="104" r="8" fill="#0a1322"/></g>'
        + '<text x="310" y="170" fill="#2de0d8" font-size="12" text-anchor="middle" font-weight="700" font-family="Inter,sans-serif">A Receptor On The Cell Surface</text>'
        + '</svg></div>'
        + '<div class="v14-card"><div class="v14-ic">'+H.ic('M3 12h4l3 9 4-18 3 9h4')+'</div><h4>One Cell, Many Locks</h4><p>A single cell can carry many different receptors. A peptide only wakes up the exact one it was shaped for, so it talks to that cell and no other.</p></div>';

    var P3 = H.eyebrow(3,3,5)
      + '<h1 class="v14-h">What Happens After It Binds</h1>'
      + '<p class="v14-lead">Once the key is in the lock, four things happen in order.</p>'
      + cascade();

    var P4 = H.eyebrow(3,4,5)
      + '<h1 class="v14-h">One Key, One Lock</h1>'
      + '<p class="v14-lead">This exact-fit is why peptides are so precise. The wrong shape simply will not open the lock.</p>'
      + '<div class="v14-cards" style="grid-template-columns:1fr 1fr;">'
        + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #22c55e;"><div class="v14-ic" style="background:radial-gradient(circle at 50% 28%,#0f2a25,#0a1322) padding-box,linear-gradient(155deg,#a6f0df,#1f8f7d,#7fe0cf) border-box;">'+H.ic('M20 6 9 17l-5-5')+'</div><h4 style="color:#9af0d6;">Right Shape</h4><p>The key matches the lock, so the door opens and the cell acts.</p></div>'
        + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #E53E3E;"><div class="v14-ic" style="background:radial-gradient(circle at 50% 28%,#2a1414,#0a1322) padding-box,linear-gradient(155deg,#f0a6a6,#8f1f1f,#e07f7f) border-box;">'+H.ic('M18 6 6 18M6 6l12 12')+'</div><h4 style="color:#f7b4b4;">Wrong Shape</h4><p>The key does not fit, so nothing happens. The cell ignores it.</p></div>'
      + '</div>';

    var P5 = H.eyebrow(3,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 4.</p>'
      + '<div class="v14-q" id="m3q1"><div class="qn">Question 1 Of 2</div><div class="qt">A peptide can only work if...</div>'
        + H.opt('It is very large',0) + H.opt('Its shape matches the lock',1) + H.opt('It is a certain color',0)
        + '<div class="v14-fb">Correct. The peptide must be shaped to fit its receptor, like a key in a lock.</div></div>'
      + '<div class="v14-q" id="m3q2"><div class="qn">Question 2 Of 2</div><div class="qt">What do scientists call the lock on a cell?</div>'
        + H.opt('A receptor',1) + H.opt('A battery',0) + H.opt('A protein chain',0)
        + '<div class="v14-fb">Right. The lock is called a receptor.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('Peptides work like keys that fit cell locks.')
        + H.recap('The lock is called a receptor.')
        + H.recap('A match opens the lock and sends a signal into the cell.')
        + H.recap('The exact-fit is why peptides are so precise.')
      + '</ul></div>';

    H.module('s3', 3, 2, 4, labels, function(){ return [P1,P2,P3,P4,P5]; });
  }
  start();
})();
