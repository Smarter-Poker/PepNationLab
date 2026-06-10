/* Peptide 101 - Module 8: Reconstitution Calculator (paginated, v14) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['What It Means','The Formula','Calculator','Technique','Quick Check'];

    var P1 = H.eyebrow(8,1,5)
      + '<h1 class="v14-h">Reconstitution Calculator</h1>'
      + '<p class="v14-lead">Most peptides arrive as a dry powder. To use them, you add special water to turn the powder into a liquid. That step is called reconstitution, which just means make it liquid again.</p>'
      + '<div class="v14-stage-frame"><svg class="v14-svg" viewBox="0 0 620 170" xmlns="http://www.w3.org/2000/svg">'
        + '<g filter="url(#v14sh)"><rect x="70" y="46" width="90" height="84" rx="12" fill="#0f2a25" stroke="#2de0d8" stroke-width="2"/><rect x="95" y="34" width="40" height="16" rx="4" fill="#13362f" stroke="#2de0d8" stroke-width="2"/></g>'
        + '<text x="115" y="92" fill="#2de0d8" font-size="20" font-weight="800" text-anchor="middle" font-family="Inter,sans-serif">5mg</text>'
        + '<text x="115" y="112" fill="#9fb0c2" font-size="11" text-anchor="middle" font-family="Inter,sans-serif">Vial Powder</text>'
        + '<text x="210" y="95" fill="#7fb3ff" font-size="30" font-weight="300" text-anchor="middle">+</text>'
        + '<g filter="url(#v14sh)"><rect x="255" y="46" width="90" height="84" rx="12" fill="#13233c" stroke="#5ea0ff" stroke-width="2"/></g>'
        + '<text x="300" y="92" fill="#7fb3ff" font-size="20" font-weight="800" text-anchor="middle" font-family="Inter,sans-serif">2mL</text>'
        + '<text x="300" y="112" fill="#9fb0c2" font-size="11" text-anchor="middle" font-family="Inter,sans-serif">BAC Water</text>'
        + '<text x="395" y="95" fill="#7fb3ff" font-size="26" font-weight="300" text-anchor="middle">=</text>'
        + '<g class="v14-pulse" filter="url(#v14sh)"><rect x="440" y="46" width="110" height="84" rx="12" fill="url(#v14beadT)"/></g>'
        + '<text x="495" y="88" fill="#04201d" font-size="20" font-weight="800" text-anchor="middle" font-family="Inter,sans-serif">2500</text>'
        + '<text x="495" y="108" fill="#04302b" font-size="11" text-anchor="middle" font-family="Inter,sans-serif">mcg/mL</text>'
        + '</svg></div>'
      + '<div class="v14-bridge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg><p><b>The big idea:</b> how much water you add decides how strong or weak the liquid turns out.</p></div>';

    var P2 = H.eyebrow(8,2,5)
      + '<h1 class="v14-h">The Simple Formula</h1>'
      + '<p class="v14-lead">There is just one piece of math, and the calculator on the next page does it for you.</p>'
      + '<div class="v14-card"><div class="v14-ic">'+H.ic('M4 2h16v6l-4 4 4 4v6H4v-6l4-4-4-4z')+'</div><h4>How Strength Works</h4><p>The same powder can be made strong or weak depending only on how much water you add. Less water makes it stronger. More water makes it weaker.</p></div>'
      + '<div class="v14-card" style="box-shadow:0 10px 26px rgba(0,0,0,.45),inset 4px 0 0 #2de0d8;"><h4 style="color:#2de0d8;">The Formula</h4><p style="font-size:14px;color:#dbe6f2;">(Vial mg multiplied by 1000) divided by your target concentration in mcg/mL equals the mL of water to add.</p></div>';

    var P3 = H.eyebrow(8,3,5)
      + '<h1 class="v14-h">Interactive Calculator</h1>'
      + '<p class="v14-lead">Pick your vial size and the strength you want. The answer updates as you type.</p>'
      + '<div class="v14-card">'
        + '<div style="display:flex;flex-direction:column;gap:16px;">'
        + '<div>'
          + '<label style="font-size:13px;display:block;margin-bottom:6px;color:#cdd9e6;" for="calcVial">Vial Size (mg)</label>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">'
            + '<button class="calc-preset" onclick="setPreset(2)" aria-label="Set 2mg vial">2 mg</button>'
            + '<button class="calc-preset" onclick="setPreset(5)" aria-label="Set 5mg vial">5 mg</button>'
            + '<button class="calc-preset" onclick="setPreset(10)" aria-label="Set 10mg vial">10 mg</button>'
          + '</div>'
          + '<input type="number" id="calcVial" min="0.5" max="100" step="0.5" value="5" class="calc-input" oninput="calcRecon()" aria-label="Vial size in milligrams"/>'
        + '</div>'
        + '<div>'
          + '<label style="font-size:13px;display:block;margin-bottom:6px;color:#cdd9e6;" for="calcConc">Target Concentration (mcg/mL)</label>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">'
            + '<button class="calc-preset" onclick="setConc(500)" aria-label="Set 500 mcg/mL">500</button>'
            + '<button class="calc-preset" onclick="setConc(1000)" aria-label="Set 1000 mcg/mL">1000</button>'
            + '<button class="calc-preset" onclick="setConc(2000)" aria-label="Set 2000 mcg/mL">2000</button>'
            + '<button class="calc-preset" onclick="setConc(2500)" aria-label="Set 2500 mcg/mL">2500</button>'
          + '</div>'
          + '<input type="number" id="calcConc" min="100" max="10000" step="100" value="1000" class="calc-input" oninput="calcRecon()" aria-label="Target concentration in micrograms per milliliter"/>'
        + '</div>'
        + '<div id="calcResult" style="padding:16px;background:linear-gradient(135deg,rgba(0,196,188,0.12),rgba(59,130,246,0.08));border:1px solid rgba(0,196,188,0.3);border-radius:12px;">'
          + '<div style="font-size:12px;color:#9fb0c2;margin-bottom:4px;">Add This Much BAC Water:</div>'
          + '<div style="font-size:36px;font-weight:800;color:#2de0d8;" id="calcWater">5.00 mL</div>'
          + '<div style="font-size:12px;color:#9fb0c2;margin-top:8px;" id="calcSummary">5 mg Vial + 5.00 mL BAC Water = 1000 mcg/mL Solution</div>'
        + '</div>'
        + '<div id="calcDoseTable" style="display:none;">'
          + '<h4 style="font-size:13px;margin-bottom:10px;color:#eaf2fb;">Drawing Table For This Concentration</h4>'
          + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;" aria-label="Dose to volume reference table">'
            + '<thead><tr style="border-bottom:1px solid rgba(150,170,200,.2);"><th style="padding:8px;text-align:left;color:#9fb0c2;">Dose</th><th style="padding:8px;text-align:right;color:#9fb0c2;">Volume</th><th style="padding:8px;text-align:right;color:#9fb0c2;">100-Unit Syringe</th></tr></thead>'
            + '<tbody id="calcTableBody"></tbody></table></div>'
        + '</div>'
        + '</div></div>';

    function step(n, body){
      return '<div style="display:flex;gap:11px;align-items:flex-start;margin-bottom:9px;">'
        + '<div style="min-width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:#04201d;font-weight:800;font-size:12px;background:#2de0d8;flex-shrink:0;box-shadow:0 0 10px rgba(45,224,216,.5);">'+n+'</div>'
        + '<p style="font-size:13px;line-height:1.5;color:#c4d0dd;margin:0;padding-top:3px;">'+body+'</p></div>';
    }
    var P4 = H.eyebrow(8,4,5)
      + '<h1 class="v14-h">Reconstitution Technique</h1>'
      + '<p class="v14-lead">Five gentle steps. The goal is clean and slow, never rushed or shaken.</p>'
      + '<div class="v14-card">'
        + step(1,'Let the powder vial and the water warm up to room temperature first.')
        + step(2,'Wipe the vial top with an alcohol pad and let it dry. This keeps germs out.')
        + step(3,'Add the water slowly, letting it run down the side of the glass, not straight onto the powder.')
        + step(4,'Gently swirl until it looks clear. Do not shake hard. Shaking makes bubbles that can damage it, like shaking a soda can.')
        + step(5,'Label it with the name and date, then put it straight in the fridge. Use it within about 4 weeks.')
      + '</div>';

    var P5 = H.eyebrow(8,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two fast questions, then you are ready for Module 9.</p>'
      + '<div class="v14-q" id="m8q1"><div class="qn">Question 1 Of 2</div><div class="qt">If you add LESS water to the same vial, the liquid becomes...</div>'
        + H.opt('Weaker',0) + H.opt('Stronger',1) + H.opt('Exactly the same',0)
        + '<div class="v14-fb">Correct. Less water means a smaller volume holding the same amount of peptide, so it is stronger.</div></div>'
      + '<div class="v14-q" id="m8q2"><div class="qn">Question 2 Of 2</div><div class="qt">Why should you swirl gently instead of shaking hard?</div>'
        + H.opt('Shaking is too slow',0) + H.opt('Hard shaking makes bubbles that can damage the peptide',1) + H.opt('It does not matter',0)
        + '<div class="v14-fb">Right. Rough shaking creates foam and bubbles that can break the fragile peptide.</div></div>'
      + '<div class="v14-recap"><h4>'+H.ic('M9 11l3 3L22 4')+'Key Takeaways</h4><ul style="margin:0;padding:0;">'
        + H.recap('Reconstitution means turning dry powder into a liquid with BAC water.')
        + H.recap('Less water makes a stronger solution, more water makes it weaker.')
        + H.recap('Formula: (vial mg x 1000) / target mcg/mL = mL of water to add.')
        + H.recap('Add water gently, swirl do not shake, then label and refrigerate.')
      + '</ul></div>';

    H.module('s8', 8, 7, 9, labels, function(){ return [P1,P2,P3,P4,P5]; });

    // Populate the interactive calculator once its inputs exist in the DOM
    var tries=0;
    var t=setInterval(function(){
      if(document.getElementById('calcVial') && typeof window.calcRecon==='function'){
        try{ window.calcRecon(); }catch(e){}
        clearInterval(t);
      } else if(tries++>200){ clearInterval(t); }
    },50);
  }
  start();
})();
