/* Peptide 101 - Module 12: Safety, Purity And Sourcing (screen s13, paginated v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['Why It Matters','Reading A COA','More Checks','Red Flags','Quick Check'];

    var P1 = H.eyebrow(12,1,5)
      + '<h1 class="v14-h">Safety, Purity And Sourcing</h1>'
      + '<p class="v14-lead">For real research, one question matters more than any other: is what you have actually what the label says, and is it clean? Here is how you know.</p>'
      + '<div class="v14-card"><div class="v14-ic">'+H.ic('M12 3l8 3v6c0 5-3.5 7.6-8 9-4.5-1.4-8-4-8-9V6z')+'</div><h4>Why Research-Grade Matters</h4><p>Two vials can look identical and be completely different inside. Research-grade means the batch was tested, you know what is in it, how pure it is, and that it is free of contamination. Untested material is a guess.</p></div>'
      + '<div class="v14-bridge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg><p><b>The most important module:</b> the single most important topic for real research is whether what you have is pure and safe.</p></div>';

    function coa(path,title,body,accent){ accent=accent||'#7fb3ff'; return '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 '+accent+';"><div class="v14-ic">'+H.ic(path)+'</div><h4 style="color:'+accent+';">'+title+'</h4><p>'+body+'</p></div>'; }

    var P2 = H.eyebrow(12,2,5)
      + '<h1 class="v14-h">How To Read A COA</h1>'
      + '<p class="v14-lead">A COA (Certificate Of Analysis) is the lab report for a specific batch. The first two things to look for:</p>'
      + coa('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3','Identity (Mass Spec)','Confirms the molecule is actually the peptide on the label, by its exact weight.','#2de0d8')
      + coa('M3 3v18h18M7 14l4-4 3 3 5-6','Purity (HPLC Percent)','Shows how much is the real peptide versus leftovers. Look for a high percent, often 98 or higher.','#7fb3ff');

    var P3 = H.eyebrow(12,3,5)
      + '<h1 class="v14-h">More COA Checks</h1>'
      + '<p class="v14-lead">The other two things a good COA proves:</p>'
      + coa('M12 3l8 3v6c0 5-3.5 7.6-8 9-4.5-1.4-8-4-8-9V6z','Sterility And Endotoxin','Confirms it is free of bacteria and their byproducts.','#a78bfa')
      + coa('M3 4h18v17H3zM3 9h18M8 2v4M16 2v4','Batch Number And Date','The COA should match the exact batch you received, not a generic one.','#2de0d8');

    var P4 = H.eyebrow(12,4,5)
      + '<h1 class="v14-h">Red Flags To Watch For</h1>'
      + '<p class="v14-lead">If you see any of these, slow down and ask questions.</p>'
      + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #E53E3E;"><div class="v14-ic">'+H.ic('M12 3 2 20h20zM12 9v5M12 17h.01')+'</div><h4 style="color:#f7b4b4;">Warning Signs</h4>'
        + '<ul style="margin:8px 0 0;padding:0;list-style:none;">'
        + '<li style="display:flex;gap:8px;font-size:13px;color:#cdd9e6;margin-bottom:6px;"><span style="color:#E53E3E;">&#10007;</span>No COA available at all.</li>'
        + '<li style="display:flex;gap:8px;font-size:13px;color:#cdd9e6;margin-bottom:6px;"><span style="color:#E53E3E;">&#10007;</span>A generic COA that does not match your batch.</li>'
        + '<li style="display:flex;gap:8px;font-size:13px;color:#cdd9e6;margin-bottom:6px;"><span style="color:#E53E3E;">&#10007;</span>Cloudy or off-color powder.</li>'
        + '<li style="display:flex;gap:8px;font-size:13px;color:#cdd9e6;margin-bottom:6px;"><span style="color:#E53E3E;">&#10007;</span>Missing batch numbers.</li>'
        + '<li style="display:flex;gap:8px;font-size:13px;color:#cdd9e6;"><span style="color:#E53E3E;">&#10007;</span>A price that seems too good to be true.</li>'
        + '</ul></div>';

    var P5 = H.eyebrow(12,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 13.</p>'
      + '<div class="v14-q" id="m12q1"><div class="qn">Question 1 Of 2</div><div class="qt">A Certificate Of Analysis (COA) mainly proves...</div>'
        + H.opt('The Price Is Fair',0) + H.opt('Identity And Purity Of The Batch',1) + H.opt('The Color Looks Nice',0)
        + '<div class="v14-fb">Correct. A COA proves the identity and purity of that specific batch.</div></div>'
      + '<div class="v14-q" id="m12q2"><div class="qn">Question 2 Of 2</div><div class="qt">Which of these is a red flag?</div>'
        + H.opt('A COA that matches your batch number',0) + H.opt('No COA available at all',1) + H.opt('A clear, colorless powder',0)
        + '<div class="v14-fb">Right. No COA means the material is untested, which is a guess.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('Research-grade means the batch was tested and verified.')
        + H.recap('A COA proves identity, purity, sterility, and batch match.')
        + H.recap('Look for purity of 98 percent or higher.')
        + H.recap('No COA, a generic COA, or off-color powder are red flags.')
      + '</ul></div>';

    H.module('s13', 12, 12, 14, labels, function(){ return [P1,P2,P3,P4,P5]; }, {nextLabel:'Module 13'});
  }
  start();
})();
