/* Peptide 101 - Module 9: Dosing Reference (paginated, v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['What Dosing Is','How Much','The Table','Routes','Quick Check'];

    var P1 = H.eyebrow(9,1,5)
      + '<h1 class="v14-h">Dosing Reference Table</h1>'
      + '<p class="v14-lead">Different peptides need different amounts. The dose is just how much you use. This module shows the amounts scientists use in studies, and how to read them.</p>'
      + '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 160" xmlns="http://www.w3.org/2000/svg">'
        + '<ellipse cx="310" cy="142" rx="200" ry="10" fill="#05101f" opacity="0.5"/>'
        + '<g filter="url(#v14sh)"><rect x="180" y="40" width="80" height="90" rx="10" fill="#13233c" stroke="#5ea0ff" stroke-width="2"/><rect x="205" y="28" width="30" height="14" rx="3" fill="#16263f" stroke="#5ea0ff" stroke-width="2"/></g>'
        + '<line x1="200" y1="58" x2="240" y2="58" stroke="#2a4c7d" stroke-width="2"/><line x1="200" y1="72" x2="240" y2="72" stroke="#2a4c7d" stroke-width="2"/><line x1="200" y1="86" x2="240" y2="86" stroke="#2a4c7d" stroke-width="2"/>'
        + '<g class="v14-float" filter="url(#v14sh)"><rect x="300" y="58" width="150" height="22" rx="6" fill="url(#v14beadT)"/><circle cx="445" cy="52" r="10" fill="#2de0d8"/></g>'
        + '<text x="375" y="74" fill="#04201d" font-size="12" font-weight="800" text-anchor="middle" font-family="Inter,sans-serif">100-300 mcg</text>'
        + '<text x="375" y="108" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Every Peptide Has Its Own Amount</text>'
        + '</svg></div>'
      + '<div class="v14-bridge" style="box-shadow:0 8px 22px rgba(0,0,0,.45),inset 4px 0 0 #E53E3E;"><svg viewBox="0 0 24 24" fill="none" stroke="#E53E3E" stroke-width="2"><path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/></svg><p><b>Research use only:</b> these numbers come from lab and early studies. They are not instructions for people, and none are approved medicines.</p></div>';

    var P2 = H.eyebrow(9,2,5)
      + '<h1 class="v14-h">How Much, How Often</h1>'
      + '<p class="v14-lead">Two things decide a dose: the amount each time, and how often it is used. They go together.</p>'
      + '<div class="v14-cards" style="grid-template-columns:1fr 1fr;">'
        + H.iconCard('M3 12h18M3 6h18M3 18h18','Dose Range','How much is used each time. Tiny peptides are measured in mcg (micrograms), bigger amounts in mg (milligrams).','#2de0d8')
        + H.iconCard('M12 8v4l3 2M12 3a9 9 0 1 0 9 9','Frequency','How often it is used, from once a day to twice a week. Slower-clearing peptides are used less often.','#7fb3ff')
      + '</div>'
      + '<div class="v14-card"><div class="v14-ic">'+H.ic('M12 8v4l3 2M12 3a9 9 0 1 0 9 9')+'</div><h4>Half-Life Ties It Together</h4><p>Half-life is how long a peptide lasts in the body. A short half-life means it is used more often. A long half-life means it can be used less often.</p></div>';

    var P3 = H.eyebrow(9,3,5)
      + '<h1 class="v14-h">The Reference Table</h1>'
      + '<p class="v14-lead">Tap any heading to sort it, or filter by name. These are the amounts used in studies.</p>'
      + '<div class="v14-card" style="padding:0;overflow:hidden;">'
        + '<div style="padding:12px 16px;border-bottom:1px solid rgba(150,170,200,.2);"><input type="text" id="doseSearch" class="calc-input" placeholder="Filter By Peptide Name..." oninput="filterDose()" aria-label="Filter dosing table" style="margin-bottom:0;"/></div>'
        + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;" id="doseTable" aria-label="Peptide dosing reference table">'
          + '<thead><tr style="background:#16263f;">'
            + '<th class="sort-th" onclick="sortDose(0)" style="padding:12px 16px;text-align:left;cursor:pointer;white-space:nowrap;color:#cdd9e6;" aria-sort="none">Peptide <span class="sort-arrow">&#8597;</span></th>'
            + '<th class="sort-th" onclick="sortDose(1)" style="padding:12px 16px;text-align:left;cursor:pointer;white-space:nowrap;color:#cdd9e6;" aria-sort="none">Dose Range <span class="sort-arrow">&#8597;</span></th>'
            + '<th class="sort-th" onclick="sortDose(2)" style="padding:12px 16px;text-align:left;cursor:pointer;white-space:nowrap;color:#cdd9e6;" aria-sort="none">Frequency <span class="sort-arrow">&#8597;</span></th>'
            + '<th class="sort-th" onclick="sortDose(3)" style="padding:12px 16px;text-align:left;cursor:pointer;white-space:nowrap;color:#cdd9e6;" aria-sort="none">Half-Life <span class="sort-arrow">&#8597;</span></th>'
            + '<th class="sort-th" onclick="sortDose(4)" style="padding:12px 16px;text-align:left;cursor:pointer;white-space:nowrap;color:#cdd9e6;" aria-sort="none">Route <span class="sort-arrow">&#8597;</span></th>'
          + '</tr></thead><tbody id="doseTableBody"></tbody></table></div></div>';

    var P4 = H.eyebrow(9,4,5)
      + '<h1 class="v14-h">Route Abbreviations</h1>'
      + '<p class="v14-lead">The route is where the peptide goes in. Three show up the most.</p>'
      + '<div class="v14-cards c3">'
        + H.iconCard('M12 2a7 7 0 0 0-7 7c0 3 7 13 7 13s7-10 7-13a7 7 0 0 0-7-7z','Sub-Q','Subcutaneous, a small injection just under the skin. The most common route.','#2de0d8')
        + H.iconCard('M6 18 L10 12 L14 15 L18 7','IM','Intramuscular, an injection into the muscle. Used for some longer-acting peptides.','#7fb3ff')
        + H.iconCard('M12 2v8M8 6l4-4 4 4M5 14h14l-2 7H7z','Intranasal','Given as a nasal spray instead of an injection. Used by a few peptides like Selank.','#a78bfa')
      + '</div>';

    var P5 = H.eyebrow(9,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 10.</p>'
      + '<div class="v14-q" id="m9q1"><div class="qn">Question 1 Of 2</div><div class="qt">A peptide with a SHORT half-life is usually used...</div>'
        + H.opt('Less often',0) + H.opt('More often',1) + H.opt('Only once ever',0)
        + '<div class="v14-fb">Correct. A short half-life means it leaves the body fast, so it is used more often.</div></div>'
      + '<div class="v14-q" id="m9q2"><div class="qn">Question 2 Of 2</div><div class="qt">What does Sub-Q mean?</div>'
        + H.opt('Into a vein',0) + H.opt('Just under the skin',1) + H.opt('As a pill',0)
        + '<div class="v14-fb">Right. Sub-Q is subcutaneous, a small injection just under the skin.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('A dose is the amount used, plus how often it is used.')
        + H.recap('Tiny amounts are measured in mcg, larger amounts in mg.')
        + H.recap('Half-life decides frequency: short means more often.')
        + H.recap('Sub-Q (under the skin) is the most common route.')
      + '</ul></div>';

    H.module('s9', 9, 8, 11, labels, function(){ return [P1,P2,P3,P4,P5]; }, {nextLabel:'Module 10'});

    // Populate the dosing table once its body exists in the DOM
    var tries=0;
    var t=setInterval(function(){
      if(document.getElementById('doseTableBody') && typeof window.renderDoseTable==='function'){
        try{ window.renderDoseTable(); }catch(e){}
        clearInterval(t);
      } else if(tries++>200){ clearInterval(t); }
    },50);
  }
  start();
})();
