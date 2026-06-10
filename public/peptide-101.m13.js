/* Peptide 101 - Module 13: Legality And Research Use (screen s14, paginated v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['The Simple Version','Research Use Only','A Sign Of Standards','Putting It Together','Quick Check'];

    var P1 = H.eyebrow(13,1,5)
      + '<h1 class="v14-h">Legality And Research Use</h1>'
      + '<p class="v14-lead">This part is short and simple, but it matters. Here is the honest, clear version.</p>'
      + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #2de0d8;"><div class="v14-ic">'+H.ic('M12 3v18M6 21h12M4 8h16M7 8l-2.5 5.5h5zM17 8l-2.5 5.5h5z')+'</div><h4 style="color:#2de0d8;">The Simple Version</h4><p>Research peptides are sold for laboratory research only. They are not approved for human use, they are not medicines, and they are not prescribed. That is not a loophole, it is what they are.</p></div>';

    var P2 = H.eyebrow(13,2,5)
      + '<h1 class="v14-h">What "Research Use Only" Means</h1>'
      + '<p class="v14-lead">The phrase is plain once you unpack it.</p>'
      + '<div class="v14-card"><div class="v14-ic">'+H.ic('M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z')+'</div><h4>For The Lab, Not The Body</h4><p>It means the material is intended for studying in a lab setting, measuring, testing, and learning. It has not gone through the approval process required before anything can be used in or on people.</p></div>';

    var P3 = H.eyebrow(13,3,5)
      + '<h1 class="v14-h">A Sign Of Standards, Not A Warning</h1>'
      + '<p class="v14-lead">The research-use framing is a good thing, not a scary one.</p>'
      + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #7fb3ff;"><div class="v14-ic">'+H.ic('M12 3l8 3v6c0 5-3.5 7.6-8 9-4.5-1.4-8-4-8-9V6zM9 12l2 2 4-4')+'</div><h4 style="color:#7fb3ff;">Rigor, Not Fear</h4><p>The research-use framing is not meant to scare you. It is a sign that the field takes rigor seriously: clear labeling, honest limits, and respect for the rules. Always follow your local laws and any institutional guidelines.</p></div>';

    var P4 = H.eyebrow(13,4,5)
      + '<h1 class="v14-h">Putting It All Together</h1>'
      + '<p class="v14-lead">You have covered the whole picture, from what a peptide is to how to handle it responsibly.</p>'
      + '<div class="v14-cards" style="grid-template-columns:1fr 1fr;">'
        + H.iconCard('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z','What They Are','Short chains of amino acids that act as gentle signals.','#2de0d8')
        + H.iconCard('M12 3l8 3v6c0 5-3.5 7.6-8 9-4.5-1.4-8-4-8-9V6z','Handled Right','Stored cold, mixed gently, sourced with a real COA.','#7fb3ff')
      + '</div>'
      + '<div class="v14-bridge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><p><b>Almost done:</b> finish the quick check, then the final assessment unlocks your certificate.</p></div>';

    var P5 = H.eyebrow(13,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then on to the final assessment.</p>'
      + '<div class="v14-q" id="m13q1"><div class="qn">Question 1 Of 2</div><div class="qt">"Research Use Only" means the peptide is...</div>'
        + H.opt('Approved For Human Use',0) + H.opt('For Laboratory Research Only',1) + H.opt('A Prescription Drug',0)
        + '<div class="v14-fb">Correct. Research use only means it is intended for laboratory study, not for people.</div></div>'
      + '<div class="v14-q" id="m13q2"><div class="qn">Question 2 Of 2</div><div class="qt">The research-use label is best understood as...</div>'
        + H.opt('A scary warning to ignore',0) + H.opt('A sign the field takes rigor and honesty seriously',1) + H.opt('A loophole',0)
        + '<div class="v14-fb">Right. It reflects clear labeling, honest limits, and respect for the rules.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('Research peptides are sold for laboratory research only.')
        + H.recap('They are not approved medicines and are not prescribed.')
        + H.recap('The research-use label is a sign of standards, not a scare.')
        + H.recap('Always follow your local laws and institutional guidelines.')
      + '</ul></div>';

    H.module('s14', 13, 13, 15, labels, function(){ return [P1,P2,P3,P4,P5]; }, {nextLabel:'Final Assessment'});
  }
  start();
})();
