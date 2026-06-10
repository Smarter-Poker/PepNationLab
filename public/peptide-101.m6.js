/* Peptide 101 - Module 6: Peptide Families And Categories (paginated, v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['The Families','Recovery & Growth','Metabolic & Skin','Mind & Signals','Quick Check'];
    function chips(arr,c){ c=c||'#2de0d8'; return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">'+arr.map(function(n){return '<span style="font-size:11px;font-weight:700;color:'+c+';background:'+c+'1f;border:1px solid '+c+'4d;border-radius:999px;padding:3px 10px;">'+n+'</span>';}).join('')+'</div>'; }
    function fam(pathSvg,title,body,peptides,accent){ accent=accent||'#7fb3ff'; return '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 '+accent+';"><div class="v14-ic">'+H.ic(pathSvg)+'</div><h4 style="color:'+accent+';">'+title+'</h4><p>'+body+'</p>'+chips(peptides,accent)+'</div>'; }

    var P1 = H.eyebrow(6,1,5)
      + '<h1 class="v14-h">Peptide Families And Categories</h1>'
      + '<p class="v14-lead">Just like your family has cousins and siblings, peptides have families too. Each family does a different kind of job in the body.</p>'
      + '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 210" xmlns="http://www.w3.org/2000/svg">'
        + '<g stroke="url(#v14bond)" stroke-width="3" fill="none" opacity="0.7"><path d="M310 55 L120 150"/><path d="M310 55 L235 150"/><path d="M310 55 L385 150"/><path d="M310 55 L500 150"/></g>'
        + '<g class="v14-float" filter="url(#v14sh)"><circle cx="310" cy="50" r="30" fill="url(#v14beadT)"/><ellipse cx="301" cy="42" rx="9" ry="5" fill="#fff" opacity="0.5"/></g>'
        + [120,235,385,500].map(function(x){return '<g filter="url(#v14sh)"><circle cx="'+x+'" cy="160" r="22" fill="url(#v14bead)"/><ellipse cx="'+(x-6)+'" cy="154" rx="6" ry="4" fill="#fff" opacity="0.5"/></g>';}).join('')
        + '<text x="310" y="200" fill="#9fb0c2" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">Six Families, Each With Its Own Job</text>'
        + '</svg></div>'
      + '<div class="v14-bridge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg><p><b>Tip:</b> grouping peptides into families makes them much easier to keep straight.</p></div>';

    var P2 = H.eyebrow(6,2,5)
      + '<h1 class="v14-h">Recovery And Growth</h1>'
      + '<p class="v14-lead">The two biggest families: one repairs, one builds.</p>'
      + fam('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z','Tissue And Recovery','Helps the body heal and repair itself, things like skin, muscle, and tendons.',['BPC-157','TB-500','GHK-Cu'],'#2de0d8')
      + fam('M6 18 L10 12 L14 15 L18 7','Growth Hormone Axis','Tells the body to grow and build, by nudging it to make more of its own growth signals.',['Sermorelin','CJC-1295','Ipamorelin','GHRP-6'],'#7fb3ff');

    var P3 = H.eyebrow(6,3,5)
      + '<h1 class="v14-h">Metabolic And Skin</h1>'
      + '<p class="v14-lead">One family manages energy and fat. Another is studied for skin and aging.</p>'
      + fam('M13 2 3 14h9l-1 8 10-12h-9l1-8z','Metabolic And Fat Regulation','Helps the body use energy and manage fat, without telling the body to grow.',['AOD-9604','Fragment 176-191'],'#eab308')
      + fam('M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z','Skin, Collagen And Anti-Aging','Studied for healthier, bouncier skin and for slowing down signs of aging.',['GHK-Cu','Epithalon'],'#a78bfa');

    var P4 = H.eyebrow(6,4,5)
      + '<h1 class="v14-h">Mind And Signals</h1>'
      + '<p class="v14-lead">The last two families work on signals and the brain.</p>'
      + fam('M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19','Melanocortin System','Affects things like skin color and certain brain and body signals.',['PT-141','Melanotan II'],'#f0a6a6')
      + fam('M12 2a7 7 0 0 0-4 12.7V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4.3A7 7 0 0 0 12 2z','Cognitive And Nootropic','Studied for focus, memory, and feeling calm.',['Selank','Semax'],'#5ea0ff');

    var P5 = H.eyebrow(6,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 7.</p>'
      + '<div class="v14-q" id="m6q1"><div class="qn">Question 1 Of 2</div><div class="qt">Which family helps the body heal and repair?</div>'
        + H.opt('Cognitive And Nootropic',0) + H.opt('Tissue And Recovery',1) + H.opt('Melanocortin System',0)
        + '<div class="v14-fb">Correct. Tissue and Recovery peptides like BPC-157 help the body heal.</div></div>'
      + '<div class="v14-q" id="m6q2"><div class="qn">Question 2 Of 2</div><div class="qt">Sermorelin and Ipamorelin belong to which family?</div>'
        + H.opt('Growth Hormone Axis',1) + H.opt('Skin And Anti-Aging',0) + H.opt('Metabolic And Fat',0)
        + '<div class="v14-fb">Right. These are Growth Hormone Axis peptides.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('Peptides group into families, each with its own job.')
        + H.recap('Tissue and Recovery peptides help the body heal.')
        + H.recap('Growth Hormone Axis peptides nudge the body to grow.')
        + H.recap('Other families cover metabolism, skin, signals, and the mind.')
      + '</ul></div>';

    H.module('s6', 6, 5, 7, labels, function(){ return [P1,P2,P3,P4,P5]; });
  }
  start();
})();
