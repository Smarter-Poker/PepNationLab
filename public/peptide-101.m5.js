/* Peptide 101 - Module 5: Handling And Storage (paginated, v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['Why Fragile','Dry Powder','After Mixing','Which Water','Quick Check'];

    var P1 = H.eyebrow(5,1,5)
      + '<h1 class="v14-h">Handling And Storage</h1>'
      + '<p class="v14-lead">Peptides are fragile, a bit like a snowflake. Four things break them down. Keep them away from all four.</p>'
      + '<div class="v14-cards c3" style="grid-template-columns:1fr 1fr;">'
        + H.iconCard('M12 2v6M12 22v-6M2 12h6M22 12h-6M5 5l3 3M19 19l-3-3M19 5l-3 3M5 19l3-3','Heat','Warmth slowly breaks peptides apart. Keep them cold.','#7fb3ff')
        + H.iconCard('M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19','Light','Bright light damages them. Keep them in a dark vial.','#7fb3ff')
        + H.iconCard('M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z','Water','Moisture makes dry peptides go bad. Keep them dry until use.','#7fb3ff')
        + H.iconCard('M3 12h18M12 3v18','Freeze-Thaw','Freezing and thawing over and over tears them apart.','#7fb3ff')
      + '</div>';

    var P2 = H.eyebrow(5,2,5)
      + '<h1 class="v14-h">Storing Dry Powder</h1>'
      + '<p class="v14-lead">Before water is added, a peptide is a dry powder. It is tough and lasts a long time if you keep it right.</p>'
      + '<div class="v14-card"><div class="v14-ic">'+H.ic('M6 2h12v6l-4 4 4 4v6H6v-6l4-4-4-4z')+'</div><h4>The Dry Storage Rules</h4><p>Keep it in the fridge at 36 to 46 degrees F, where dry peptides stay good for 3 to 6 months. Keep the vial dark, keep it dry, and avoid repeated freeze-thaw. Need longer? The freezer works for dry powder.</p></div>'
      + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #00C4BC;"><h4 style="color:#2de0d8;">Fridge: 36 to 46 Degrees F</h4><p>Dry powder: 3 to 6 months in the fridge, longer in the freezer.</p></div>';

    var P3 = H.eyebrow(5,3,5)
      + '<h1 class="v14-h">After You Add Water</h1>'
      + '<p class="v14-lead">Once you mix in water, a peptide becomes much more fragile. It lasts weeks now, not months.</p>'
      + H.barChart([
          {label:'Dry Powder (Fridge)', value:150, color:'#00C4BC'},
          {label:'Mixed With BAC Water', value:28, color:'#3B82F6'},
          {label:'Mixed With Sterile Water', value:3, color:'#E53E3E'}
        ], 150, 'days')
      + '<div class="v14-card"><div class="v14-ic">'+H.ic('M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3')+'</div><h4>Once It Is Liquid</h4><p>Keep it in the fridge always, and do not leave it out for more than about half an hour. Do not freeze it, sharp ice crystals tear it apart. And keep it wrapped from light.</p></div>';

    var P4 = H.eyebrow(5,4,5)
      + '<h1 class="v14-h">Which Water To Use</h1>'
      + '<p class="v14-lead">The water you mix with makes a big difference in how long it lasts.</p>'
      + '<div class="v14-cards" style="grid-template-columns:1fr 1fr;">'
        + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #2de0d8;"><div class="v14-ic">'+H.ic('M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z')+'</div><h4 style="color:#2de0d8;">BAC Water</h4><p>Bacteriostatic water has a tiny bit of alcohol that stops germs from growing. A mixed peptide lasts about 4 weeks in the fridge.</p></div>'
        + '<div class="v14-card"><div class="v14-ic">'+H.ic('M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z')+'</div><h4>Sterile Water</h4><p>Plain sterile water has nothing to stop germs, so a mixed peptide only lasts a few days.</p></div>'
      + '</div>';

    var P5 = H.eyebrow(5,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 6.</p>'
      + '<div class="v14-q" id="m5q1"><div class="qn">Question 1 Of 2</div><div class="qt">How long does a dry peptide last in the fridge?</div>'
        + H.opt('A few hours',0) + H.opt('3 to 6 months',1) + H.opt('10 years',0)
        + '<div class="v14-fb">Correct. Dry powder keeps for 3 to 6 months in the fridge.</div></div>'
      + '<div class="v14-q" id="m5q2"><div class="qn">Question 2 Of 2</div><div class="qt">Which water keeps a mixed peptide good for longer?</div>'
        + H.opt('Sterile water',0) + H.opt('BAC water',1) + H.opt('Tap water',0)
        + '<div class="v14-fb">Right. BAC water has a little alcohol that stops germs, so it lasts about 4 weeks.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('Heat, light, water, and freeze-thaw all break peptides down.')
        + H.recap('Dry powder lasts 3 to 6 months in the fridge.')
        + H.recap('Once mixed with water it lasts weeks, not months.')
        + H.recap('BAC water keeps a mixed peptide longer than sterile water.')
      + '</ul></div>';

    H.module('s5', 5, 4, 6, labels, function(){ return [P1,P2,P3,P4,P5]; });
  }
  start();
})();
