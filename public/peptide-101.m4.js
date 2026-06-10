/* Peptide 101 - Module 4: What Peptides Are Studied For (paginated, v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['Why Study Them','Repair','Growth & Energy','Sleep & Signals','Quick Check'];
    function chips(arr){ return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">'+arr.map(function(n){return '<span style="font-size:11px;font-weight:700;color:#2de0d8;background:rgba(0,196,188,.12);border:1px solid rgba(0,196,188,.3);border-radius:999px;padding:3px 10px;">'+n+'</span>';}).join('')+'</div>'; }
    function area(pathSvg, title, body, peptides, accent){
      return '<div class="v14-card"><div class="v14-ic">'+H.ic(pathSvg)+'</div><h4'+(accent?' style="color:'+accent+';"':'')+'>'+title+'</h4><p>'+body+'</p>'+chips(peptides)+'</div>';
    }

    var P1 = H.eyebrow(4,1,5)
      + '<h1 class="v14-h">What Peptides Are Studied For</h1>'
      + '<p class="v14-lead">Scientists study peptides because they might help with a lot of different things. Here are the main areas they are curious about.</p>'
      + '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 200" xmlns="http://www.w3.org/2000/svg">'
        + '<ellipse cx="310" cy="182" rx="200" ry="12" fill="#05101f" opacity="0.5"/>'
        + '<g class="v14-float" filter="url(#v14sh)"><circle cx="310" cy="96" r="58" fill="#0f1f37" stroke="#5ea0ff" stroke-width="2"/>'
        + '<path d="M285 96 a25 25 0 1 1 50 0 a25 25 0 1 1 -50 0" fill="none" stroke="#8fc0ff" stroke-width="3"/>'
        + '<line x1="352" y1="138" x2="392" y2="178" stroke="#8fc0ff" stroke-width="8" stroke-linecap="round"/></g>'
        + ['Repair','Growth','Energy','Sleep','Skin'].map(function(t,i){var a=(i/5)*6.28-1.2;var x=310+Math.cos(a)*150;var y=96+Math.sin(a)*70;return '<text x="'+x+'" y="'+y+'" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">'+t+'</text>';}).join('')
        + '</svg></div>'
      + '<div class="v14-bridge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg><p><b>Remember:</b> these are research areas scientists are exploring, not approved treatments.</p></div>';

    var P2 = H.eyebrow(4,2,5)
      + '<h1 class="v14-h">Repair And Recovery</h1>'
      + '<p class="v14-lead">The most studied area: helping the body fix itself faster.</p>'
      + area('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z','Helping Wounds Heal','Some peptides might help the body fix cuts, scrapes, and sore spots faster. Scientists are still learning exactly how.',['BPC-157','TB-500','GHK-Cu'],'#2de0d8');

    var P3 = H.eyebrow(4,3,5)
      + '<h1 class="v14-h">Growth And Energy</h1>'
      + '<p class="v14-lead">Some peptides nudge the body to make more of its own growth signals, or to burn fat for energy.</p>'
      + area('M6 18 L10 12 L14 15 L18 7','Building Muscle And Growth','These nudge the body to make more of its own growth signals. Scientists study how that affects muscle and body shape.',['Sermorelin','CJC-1295','Ipamorelin'])
      + area('M13 2 3 14h9l-1 8 10-12h-9l1-8z','Energy And Weight','These help the body use fat for energy. Scientists study whether they help manage weight.',['AOD-9604','CJC-1295']);

    var P4 = H.eyebrow(4,4,5)
      + '<h1 class="v14-h">Sleep And Signals</h1>'
      + '<p class="v14-lead">Other areas: better sleep, and signals like skin color.</p>'
      + area('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z','Sleep And The Brain','Some peptides are studied for better sleep. Sleep is when a lot of the body repair happens.',['Sermorelin','Ipamorelin'])
      + area('M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19','Skin And Other Signals','Some peptides affect things like skin color and certain brain and body signals. Scientists are exploring how.',['PT-141','Melanotan II']);

    var P5 = H.eyebrow(4,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 5.</p>'
      + '<div class="v14-q" id="m4q1"><div class="qn">Question 1 Of 2</div><div class="qt">Which peptide is studied for growth and building muscle?</div>'
        + H.opt('BPC-157',0) + H.opt('Ipamorelin',1) + H.opt('Selank',0)
        + '<div class="v14-fb">Correct. Ipamorelin is in the growth group, nudging the body to make more growth signals.</div></div>'
      + '<div class="v14-q" id="m4q2"><div class="qn">Question 2 Of 2</div><div class="qt">BPC-157, TB-500, and GHK-Cu are mostly studied for...</div>'
        + H.opt('Sleep',0) + H.opt('Repair and recovery',1) + H.opt('Skin color',0)
        + '<div class="v14-fb">Right. These are the repair and recovery peptides.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('Peptides are studied across repair, growth, energy, sleep, and signals.')
        + H.recap('Repair and recovery is the most studied area (BPC-157, TB-500, GHK-Cu).')
        + H.recap('Growth peptides nudge the body to make its own growth signals.')
        + H.recap('These are research areas, not approved treatments.')
      + '</ul></div>';

    H.module('s4', 4, 3, 5, labels, function(){ return [P1,P2,P3,P4,P5]; });
  }
  start();
})();
