/* Peptide 101 — Module 2: Building A Peptide (v14, redesigned + recap + quiz gate) */
(function(){
  function start(){
    if(!window.P101V14){ return setTimeout(start,40); }
    var H = window.P101V14;
    var labels = ['Linking Blocks','The Peptide Bond','Order Matters','How Big?','Quick Check','Recap'];

    /* ── Shared helpers ── */
    function sphere(letter, isB, cx, cy, r){
      var g = isB ? 'v14beadT' : 'v14bead';
      var fs = Math.round(r * 0.72);
      return '<g filter="url(#v14sh)">'
        +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="url(#'+g+')"/>'
        +'<ellipse cx="'+(cx-r*.26)+'" cy="'+(cy-r*.3)+'" rx="'+(r*.34)+'" ry="'+(r*.2)+'" fill="#fff" opacity="0.52"/>'
        +'<text x="'+cx+'" y="'+(cy+fs*.38)+'" fill="#fff" font-size="'+fs+'" text-anchor="middle" font-weight="800" font-family="Space Grotesk,sans-serif">'+letter+'</text>'
        +'</g>';
    }

    function icard(strokeColor, pathD, title, body){
      return '<div class="v14-card" style="text-align:center;">'
        +'<div class="v14-ic" style="margin:0 auto 9px;"><svg viewBox="0 0 24 24" fill="none" stroke="'+strokeColor+'" stroke-width="2"><path d="'+pathD+'"/></svg></div>'
        +'<h4 style="font-size:13.5px;margin:0 0 5px;">'+title+'</h4>'
        +'<p style="font-size:12px;line-height:1.5;margin:0;">'+body+'</p></div>';
    }

    function bRow(label, val, max, col){
      var pct = Math.max(1, Math.round(val/max*100));
      return '<div style="margin-bottom:13px;">'
        +'<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px;">'
        +'<span style="font-weight:600;color:#eaf2fb;">'+label+'</span>'
        +'<span style="color:#9fb0c2;">'+val+' Blocks</span></div>'
        +'<div style="height:13px;border-radius:99px;background:#0b1525;box-shadow:inset 0 1px 3px rgba(0,0,0,.6);overflow:hidden;">'
        +'<div style="height:100%;width:'+pct+'%;border-radius:99px;background:linear-gradient(90deg,'+col+','+col+'99);box-shadow:0 0 8px '+col+'66;"></div>'
        +'</div></div>';
    }

    /* ═══════════════════════════════════════════════════════
       PAGE 1 — Linking Blocks
    ═══════════════════════════════════════════════════════ */
    var P1 = H.eyebrow(2,1,5)
      + '<h1 class="v14-h">Building A Peptide</h1>'
      + '<p class="v14-lead">A Peptide Is Built By Linking Amino Acids Together In A Chain. Each Link Is Made One At A Time.</p>'
      + '<div style="display:flex;gap:8px;margin-bottom:0;">'
      + '<div style="flex:1;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.28);border-radius:12px;padding:10px 6px;text-align:center;"><div style="width:24px;height:24px;background:linear-gradient(180deg,#5ea0ff,#2463eb);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;margin:0 auto 6px;">1</div><div style="font-size:10px;color:#7fb3ff;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Step 1:</div><div style="font-size:11.5px;color:#cdd9e6;line-height:1.35;">Two Amino<br>Acids</div></div>'
      + '<div style="flex:1;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.28);border-radius:12px;padding:10px 6px;text-align:center;"><div style="width:24px;height:24px;background:linear-gradient(180deg,#5ea0ff,#2463eb);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;margin:0 auto 6px;">2</div><div style="font-size:10px;color:#7fb3ff;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Step 2:</div><div style="font-size:11.5px;color:#cdd9e6;line-height:1.35;">Bond<br>Forms</div></div>'
      + '<div style="flex:1;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.28);border-radius:12px;padding:10px 6px;text-align:center;"><div style="width:24px;height:24px;background:linear-gradient(180deg,#5ea0ff,#2463eb);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;margin:0 auto 6px;">3</div><div style="font-size:10px;color:#7fb3ff;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Step 3:</div><div style="font-size:11.5px;color:#cdd9e6;line-height:1.35;">Water<br>Leaves</div></div>'
      + '</div>'
      + '<div class="v14-stage-frame" style="margin-top:14px;">'
      + '<svg class="v14-svg" viewBox="0 0 620 210" xmlns="http://www.w3.org/2000/svg">'
        + '<ellipse cx="310" cy="192" rx="280" ry="10" fill="#05101f" opacity="0.45"/>'
        + sphere('A',false,86,96,36) + sphere('B',true,184,96,36)
        + '<text x="135" y="158" fill="#9fb0c2" font-size="13" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600">Two Free</text>'
        + '<text x="135" y="173" fill="#9fb0c2" font-size="13" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600">Amino Acids</text>'
        + '<path d="M248 96 h64" stroke="#5ea0ff" stroke-width="3.5" stroke-linecap="round"/>'
        + '<path d="M305 87 l14 9 -14 9" fill="none" stroke="#5ea0ff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<line x1="410" y1="96" x2="480" y2="96" stroke="url(#v14bond)" stroke-width="14" stroke-linecap="round"/>'
        + sphere('A',false,410,96,36) + sphere('B',true,480,96,36)
        + '<g class="v14-float"><circle cx="445" cy="34" r="20" fill="#2de0d8" opacity="0.88" filter="url(#v14sh)"/><text x="445" y="39" fill="#04201d" font-size="10.5" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">H\u2082O</text></g>'
        + '<path d="M445 54 L445 66" stroke="#2de0d8" stroke-width="2.5" stroke-dasharray="3,3" opacity="0.65"/>'
        + '<text x="445" y="158" fill="#9fb0c2" font-size="13" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600">Joined By</text>'
        + '<text x="445" y="173" fill="#9fb0c2" font-size="13" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600">A Peptide Bond</text>'
        + '<text x="310" y="200" fill="#2de0d8" font-size="12" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" letter-spacing="1">One Link Longer</text>'
      + '</svg></div>'
      + '<div class="v14-cards c3" style="margin:14px 0;">'
      + icard('#7fb3ff','M3 12l9-9 9 9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z','Building Blocks','Amino Acids Are<br>The Basics.')
      + icard('#5ea0ff','M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71','Peptide Bond','The Link That<br>Holds The Chain.')
      + icard('#2de0d8','M12 2v6M12 18v4M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M18 12h4M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24','Water Released','A Tiny Drop Leaves<br>With Each Link.')
      + '</div>'
      + '<div class="v14-bridge" style="margin-bottom:14px;"><div class="v14-ic" style="flex-shrink:0;width:46px;height:46px;"><svg viewBox="0 0 24 24" fill="none" stroke="#5ea0ff" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div><div><div style="font-size:14px;font-weight:800;color:#7fb3ff;margin-bottom:5px;">Plain Version</div><p style="margin:0 0 5px;font-size:13.5px;line-height:1.55;color:#dbe6f2;">Snap Two Blocks Together, A Tiny Drop Of Water Leaves, And The Chain Gets One Link Longer.</p><p style="margin:0;font-size:12.5px;color:#9fb0c2;">This Simple Reaction Is The Basic Chemistry Behind How Every Peptide Chain Is Assembled.</p></div></div>'
      + '<div class="v14-card" style="display:flex;gap:14px;align-items:center;"><div class="v14-ic" style="flex-shrink:0;"><svg viewBox="0 0 24 24" fill="none" stroke="#2de0d8" stroke-width="2"><path d="M9 18h6M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V16H8.5v-.8C6.4 13.9 5 11.6 5 9a7 7 0 0 1 7-7z"/></svg></div><div style="flex:1;"><div style="font-size:14px;font-weight:800;color:#2de0d8;margin-bottom:5px;">Remember</div><p style="margin:0;font-size:13px;line-height:1.5;color:#cdd9e6;">Amino Acids Are The Building Blocks Of Peptides. The Link Between Them Is Called The Peptide Bond.</p></div><svg viewBox="0 0 100 56" style="width:82px;flex-shrink:0;opacity:.75;" xmlns="http://www.w3.org/2000/svg"><line x1="22" y1="28" x2="78" y2="28" stroke="url(#v14bond)" stroke-width="7" stroke-linecap="round"/>'+sphere('A',false,22,28,14)+sphere('B',true,50,28,14)+sphere('A',false,78,28,14)+'</svg></div>';

    /* ═══════════════════════════════════════════════════════
       PAGE 2 — The Peptide Bond
    ═══════════════════════════════════════════════════════ */
    var P2 = H.eyebrow(2,2,5)
      + '<h1 class="v14-h">The Peptide Bond</h1>'
      + '<p class="v14-lead">The Connection Between Two Amino Acids Has A Name. It Is Called A <b>Peptide Bond</b>.</p>'
      + '<div class="v14-stage-frame">'
      + '<svg class="v14-svg" viewBox="0 0 620 230" xmlns="http://www.w3.org/2000/svg">'
        + '<text x="148" y="24" fill="#7fb3ff" font-size="12.5" text-anchor="middle" font-weight="700" font-family="Inter,sans-serif">Amino End</text>'
        + '<text x="310" y="24" fill="#2de0d8" font-size="12.5" text-anchor="middle" font-weight="700" font-family="Inter,sans-serif">Peptide Bond</text>'
        + '<text x="472" y="24" fill="#7fb3ff" font-size="12.5" text-anchor="middle" font-weight="700" font-family="Inter,sans-serif">Carboxyl End</text>'
        + '<line x1="148" y1="29" x2="185" y2="88" stroke="#7fb3ff" stroke-width="1" stroke-dasharray="4,4" opacity="0.45"/>'
        + '<line x1="310" y1="29" x2="310" y2="96" stroke="#2de0d8" stroke-width="1" stroke-dasharray="4,4" opacity="0.45"/>'
        + '<line x1="472" y1="29" x2="435" y2="88" stroke="#7fb3ff" stroke-width="1" stroke-dasharray="4,4" opacity="0.45"/>'
        + '<line x1="220" y1="114" x2="270" y2="114" stroke="url(#v14bond)" stroke-width="13" stroke-linecap="round"/>'
        + '<line x1="350" y1="114" x2="400" y2="114" stroke="url(#v14bond)" stroke-width="13" stroke-linecap="round"/>'
        + '<rect x="268" y="92" width="84" height="44" rx="12" fill="#0a1322" stroke="#2de0d8" stroke-width="2.5" class="v14-pulse"/>'
        + '<text x="310" y="116" fill="#2de0d8" font-size="15" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">-C\u2261N-</text>'
        + sphere('A',false,185,114,46) + sphere('B',true,435,114,46)
        + '<ellipse cx="310" cy="202" rx="230" ry="10" fill="#05101f" opacity="0.45"/>'
        + '<text x="185" y="185" fill="#9fb0c2" font-size="12.5" text-anchor="middle" font-family="Inter,sans-serif">Amino Acid A</text>'
        + '<text x="435" y="185" fill="#9fb0c2" font-size="12.5" text-anchor="middle" font-family="Inter,sans-serif">Amino Acid B</text>'
      + '</svg></div>'
      + '<div class="v14-cards c3" style="margin:14px 0;">'
      + icard('#7fb3ff','M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z','Strong Link','Peptide Bonds Are Strong And Stable Under Normal Conditions.')
      + icard('#5ea0ff','M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71','Chain Extension','Each Peptide Bond Adds The Next Amino Acid To Extend The Chain.')
      + icard('#2de0d8','M12 2v6M12 18v4M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M18 12h4M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24','Water Already Released','A Water Molecule Is Released As The Bond Is Formed.')
      + '</div>'
      + '<div class="v14-bridge" style="margin-bottom:14px;"><div class="v14-ic" style="flex-shrink:0;width:46px;height:46px;background:radial-gradient(circle at 50% 28%,#231048,#0a1322);"><svg viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg></div><div><div style="font-size:14px;font-weight:800;color:#7fb3ff;margin-bottom:5px;">Like Super Glue Between LEGO Bricks</div><p style="margin:0 0 5px;font-size:13.5px;color:#dbe6f2;">Once Two Amino Acids Lock Together With A Peptide Bond, They Are Much Harder To Pull Apart.</p><p style="margin:0;font-size:12.5px;color:#9fb0c2;">That Is What Holds Every Peptide In One Piece.</p></div></div>'
      + '<div class="v14-card" style="display:flex;gap:14px;"><div class="v14-ic" style="flex-shrink:0;"><svg viewBox="0 0 24 24" fill="none" stroke="#2de0d8" stroke-width="2"><path d="M9 18h6M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V16H8.5v-.8C6.4 13.9 5 11.6 5 9a7 7 0 0 1 7-7z"/></svg></div><div><h4 style="color:#2de0d8;font-size:15px;margin:0 0 6px;">Why It Matters</h4><p style="font-size:13px;color:#cdd9e6;margin:0 0 5px;">Every New Amino Acid Added To A Peptide Must Connect Through This Same Type Of Bond.</p><p style="font-size:12.5px;color:#9fb0c2;margin:0;">The Whole Chain Depends On Repeating This One Simple Connection.</p></div></div>';

    /* ═══════════════════════════════════════════════════════
       PAGE 3 — Order Matters
    ═══════════════════════════════════════════════════════ */
    var bColors = ['#3B82F6','#8B5CF6','#F97316','#22C55E','#EF4444'];
    var bLetters = ['A','B','C','D','E'];
    function colorOf(letter){ var i=bLetters.indexOf(letter); return i>=0?bColors[i]:'#7fb3ff'; }
    function chainSVG(seq, yc){
      var r=18, gap=50, out='', startX=28;
      for(var i=0;i<seq.length-1;i++){ var x1=startX+gap*i+r,x2=startX+gap*(i+1)-r; out+='<line x1="'+x1+'" y1="'+yc+'" x2="'+x2+'" y2="'+yc+'" stroke="rgba(150,180,220,.35)" stroke-width="5" stroke-linecap="round"/>'; }
      for(var j=0;j<seq.length;j++){ var bx=startX+gap*j,col=colorOf(seq[j]); out+='<circle cx="'+bx+'" cy="'+yc+'" r="'+r+'" fill="'+col+'" filter="url(#v14sh)"/><ellipse cx="'+(bx-5)+'" cy="'+(yc-6)+'" rx="6" ry="4" fill="#fff" opacity="0.38"/><text x="'+bx+'" y="'+(yc+6)+'" fill="#fff" font-size="15" text-anchor="middle" font-weight="800" font-family="Space Grotesk,sans-serif">'+seq[j]+'</text>'; }
      return out;
    }
    var P3 = H.eyebrow(2,3,5)
      + '<h1 class="v14-h">Order Matters</h1>'
      + '<p class="v14-lead">The Same Amino Acids In A Different Order Can Create A Completely Different Peptide. The Sequence Acts Like A Recipe\u2014Change The Order, Change The Result.</p>'
      + '<div class="v14-stage-frame">'
      + '<svg class="v14-svg" viewBox="0 0 580 240" xmlns="http://www.w3.org/2000/svg">'
        + '<text x="6" y="18" fill="#9fb0c2" font-size="10.5" font-family="Inter,sans-serif" font-weight="700">Peptide Sequence A</text>'
        + '<text x="6" y="32" fill="#7fb0c2" font-size="10" font-family="Inter,sans-serif">One Specific Order</text>'
        + chainSVG(['A','B','C','D','E'],58)
        + '<text x="498" y="52" fill="#7fb3ff" font-size="11" font-family="Inter,sans-serif" font-weight="700">= Peptide A</text>'
        + '<text x="498" y="65" fill="#9fb0c2" font-size="10" font-family="Inter,sans-serif">Unique Structure</text>'
        + '<text x="498" y="78" fill="#9fb0c2" font-size="10" font-family="Inter,sans-serif">&amp; Function</text>'
        + '<rect x="22" y="100" width="160" height="28" rx="8" fill="rgba(59,130,246,.1)" stroke="rgba(59,130,246,.2)" stroke-width="1"/>'
        + '<text x="102" y="119" fill="#aebccb" font-size="11.5" text-anchor="middle" font-family="Inter,sans-serif">Same Parts</text>'
        + '<text x="220" y="122" fill="#fff" font-size="18" text-anchor="middle" font-family="Inter,sans-serif" font-weight="900">\u2192</text>'
        + '<circle cx="290" cy="114" r="20" fill="rgba(0,196,188,.12)" stroke="rgba(0,196,188,.3)" stroke-width="1.5"/>'
        + '<text x="290" y="121" fill="#2de0d8" font-size="20" text-anchor="middle" font-family="Inter,sans-serif" font-weight="900">\u2260</text>'
        + '<text x="365" y="122" fill="#fff" font-size="18" text-anchor="middle" font-family="Inter,sans-serif" font-weight="900">\u2192</text>'
        + '<rect x="392" y="100" width="170" height="28" rx="8" fill="rgba(59,130,246,.1)" stroke="rgba(59,130,246,.2)" stroke-width="1"/>'
        + '<text x="477" y="119" fill="#aebccb" font-size="11.5" text-anchor="middle" font-family="Inter,sans-serif">Not The Same Peptide</text>'
        + '<text x="6" y="156" fill="#9fb0c2" font-size="10.5" font-family="Inter,sans-serif" font-weight="700">Peptide Sequence B</text>'
        + '<text x="6" y="170" fill="#7fb0c2" font-size="10" font-family="Inter,sans-serif">Different Order</text>'
        + chainSVG(['E','D','C','B','A'],196)
        + '<text x="498" y="190" fill="#7fb3ff" font-size="11" font-family="Inter,sans-serif" font-weight="700">= Peptide B</text>'
        + '<text x="498" y="203" fill="#9fb0c2" font-size="10" font-family="Inter,sans-serif">Different Structure</text>'
        + '<text x="498" y="216" fill="#9fb0c2" font-size="10" font-family="Inter,sans-serif">&amp; Function</text>'
        + '<rect x="0" y="224" width="580" height="16" rx="5" fill="rgba(0,196,188,.12)" stroke="rgba(0,196,188,.28)" stroke-width="1"/>'
        + '<text x="290" y="235" fill="#2de0d8" font-size="10.5" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">Same Parts, Different Order = Different Peptide</text>'
      + '</svg></div>'
      + '<div style="display:flex;gap:14px;align-items:center;background:linear-gradient(135deg,rgba(0,196,188,.09),rgba(59,130,246,.04));border:1.5px solid rgba(0,196,188,.25);border-radius:16px;padding:14px 18px;margin:14px 0;">'
        + '<div style="min-width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,rgba(0,196,188,.18),rgba(0,196,188,.04));border:1px solid rgba(0,196,188,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:12.5px;font-weight:900;color:#2de0d8;text-align:center;line-height:1.2;">BPC<br>157</span></div>'
        + '<div><p style="margin:0 0 5px;font-size:13.5px;color:#eaf2fb;line-height:1.5;">BPC-157 Contains <b style="color:#2de0d8;">15</b> Amino-Acid Building Blocks In <b style="color:#7fb3ff;">One Exact Order.</b></p><p style="margin:0;font-size:12px;color:#9fb0c2;">Swapping, Removing, Or Misplacing Even One Amino Acid Changes The Peptide.</p></div>'
      + '</div>'
      + '<div class="v14-card" style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px;"><div style="flex:1;"><h4 style="color:#2de0d8;font-size:15px;margin:0 0 7px;">BPC-157 Example</h4><p style="font-size:13px;color:#cdd9e6;margin:0 0 4px;">BPC-157 Is 15 Building Blocks Linked In One Exact Order. Every Single Link Matters. Swap Or Remove One And It Stops Being The Same Peptide.</p></div><div style="flex-shrink:0;text-align:center;"><svg viewBox="0 0 110 64" style="width:100px;" xmlns="http://www.w3.org/2000/svg">'+function(){var s='',r=6,items=15,cols=8;for(var i=0;i<items;i++){var col=i%cols,row=Math.floor(i/cols),x=r+1+col*(r*2+3),y=r+1+row*(r*2+5),c=i<8?'#2de0d8':'#5ea0ff';s+='<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+c+'" opacity="0.85"/>';if(col<Math.min(cols,items-row*cols)-1)s+='<line x1="'+(x+r)+'" y1="'+y+'" x2="'+(x+r+3)+'" y2="'+y+'" stroke="rgba(150,200,255,.35)" stroke-width="2"/>';}return s;}()+'</svg><div style="font-size:10.5px;color:#9fb0c2;line-height:1.35;">15 Amino Acids<br>One Exact Order</div></div></div>'
      + '<div class="v14-card" style="display:flex;gap:14px;"><div class="v14-ic" style="flex-shrink:0;"><svg viewBox="0 0 24 24" fill="none" stroke="#2de0d8" stroke-width="2"><path d="M9 18h6M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V16H8.5v-.8C6.4 13.9 5 11.6 5 9a7 7 0 0 1 7-7z"/></svg></div><div><h4 style="color:#2de0d8;font-size:15px;margin:0 0 6px;">Sequence = Recipe</h4><p style="font-size:13px;color:#cdd9e6;margin:0;">Just Like A Recipe, The Ingredients Are Important, But The Order Is What Creates The Final Dish. Peptide Function Depends On Exact Sequence, Not Just The Ingredients.</p></div></div>';

    /* ═══════════════════════════════════════════════════════
       PAGE 4 — How Big Is A Peptide?
    ═══════════════════════════════════════════════════════ */
    var P4 = H.eyebrow(2,4,5)
      + '<h1 class="v14-h">How Big Is A Peptide?</h1>'
      + '<p class="v14-lead">Peptides Are Short Chains Of Amino Acids. Proteins Are Much Longer Chains That Often Fold Into Large, Complex 3D Structures To Perform Many Functions In The Body.</p>'
      + '<div class="v14-stage-frame" style="padding:18px 20px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">'
          + '<div style="text-align:center;"><div style="font-size:11px;font-weight:800;color:#2de0d8;letter-spacing:1px;text-transform:uppercase;">PEPTIDE ZONE</div><div style="font-size:10px;color:#9fb0c2;">2\u201350 AMINO ACIDS</div></div>'
          + '<div style="width:34px;height:34px;background:linear-gradient(135deg,#1a3060,#0a1322);border:2px solid rgba(94,160,255,.4);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#7fb3ff;flex-shrink:0;">50</div>'
          + '<div style="text-align:center;"><div style="font-size:11px;font-weight:800;color:#7fb3ff;letter-spacing:1px;text-transform:uppercase;">PROTEIN ZONE</div><div style="font-size:10px;color:#9fb0c2;">51+ AMINO ACIDS</div></div>'
        + '</div>'
        + bRow('GHK-Cu',3,600,'#2de0d8') + bRow('Oxytocin',9,600,'#2de0d8') + bRow('BPC-157',15,600,'#3B82F6') + bRow('Sermorelin',29,600,'#5ea0ff') + bRow('Albumin (A Protein)',585,600,'#8B5CF6')
        + '<div style="display:flex;justify-content:space-between;font-size:10px;color:#6b7a8d;margin-top:6px;"><span>0</span><span>10</span><span>20</span><span>50</span><span>200</span><span>400</span><span>600</span></div>'
        + '<div style="text-align:center;font-size:10.5px;color:#6b7a8d;margin-top:3px;">Number Of Amino Acid Blocks</div>'
      + '</div>'
      + '<div class="v14-cards" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;">'
        + '<div class="v14-card"><div class="v14-ic"><svg viewBox="0 0 24 24" fill="none" stroke="#2de0d8" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v3l2 2"/></svg></div><h4 style="color:#2de0d8;font-size:14px;">Why Size Matters</h4><p style="font-size:12px;color:#aebccb;">The Research Peptides In This Course Sit On The Small End Of The Scale.</p><p style="font-size:12px;color:#aebccb;margin-top:5px;">Their Small Size Helps Explain Why They Move Through The Body So Easily.</p></div>'
        + '<div class="v14-card"><div class="v14-ic" style="background:radial-gradient(circle at 50% 28%,#1a3060,#0a1322);"><svg viewBox="0 0 24 24" fill="none" stroke="#7fb3ff" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><h4 style="color:#7fb3ff;font-size:14px;">Quick Rule</h4><p style="font-size:12px;color:#aebccb;">Once A Chain Grows Beyond 50 Amino Acids And Folds Into A Larger 3D Structure,</p><p style="font-size:12px;color:#aebccb;margin-top:5px;">It Is Generally Considered A Protein.</p></div>'
      + '</div>';

    /* ═══════════════════════════════════════════════════════
       PAGE 5 — Quick Check (GATED)
    ═══════════════════════════════════════════════════════ */
    function qNum(n){
      return '<span style="display:inline-flex;align-items:center;gap:8px;margin-bottom:7px;">'
        +'<span style="width:23px;height:23px;background:linear-gradient(180deg,#5ea0ff,#2463eb);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;">'+n+'</span>'
        +'<span style="font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#9fb0c2;font-weight:700;">Question '+n+' Of 2</span></span>';
    }
    var q1img = '<svg viewBox="0 0 90 58" style="width:74px;height:48px;float:right;margin:-4px 0 0 8px;" xmlns="http://www.w3.org/2000/svg">'+sphere('A',false,22,30,14)+sphere('B',true,58,30,14)+'<line x1="36" y1="30" x2="44" y2="30" stroke="url(#v14bond)" stroke-width="7" stroke-linecap="round"/><g class="v14-float"><circle cx="40" cy="9" r="9" fill="#2de0d8" opacity="0.9"/><text x="40" y="12" fill="#04201d" font-size="8" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">H\u2082O</text></g></svg>';
    var q2img = '<svg viewBox="0 0 100 44" style="width:84px;height:36px;float:right;margin:-4px 0 0 8px;" xmlns="http://www.w3.org/2000/svg">'+function(){var s='',r=7;bColors.forEach(function(c,i){var x=r+1+i*(r*2+3);s+='<circle cx="'+x+'" cy="22" r="'+r+'" fill="'+c+'" opacity="0.85"/>';if(i<bColors.length-1)s+='<line x1="'+(x+r)+'" y1="22" x2="'+(x+r+3)+'" y2="22" stroke="rgba(150,200,255,.35)" stroke-width="2.5"/>';});return s;}()+'</svg>';

    var P5 = H.eyebrow(2,5,5)
      + '<h1 class="v14-h">Quick Check</h1>'
      + '<p class="v14-lead">Two Fast Questions, Then You Are Ready For Module 3.</p>'
      + '<div class="v14-q" id="m2q1">'+qNum(1)+q1img+'<div class="qt">When Two Amino Acids Link, What Leaves?</div>'+H.opt('A Spark',0)+H.opt('A Tiny Drop Of Water',1)+H.opt('Nothing',0)+'<div class="v14-fb">Correct. A Tiny Drop Of Water Pops Out Each Time A New Peptide Bond Forms.</div></div>'
      + '<div class="v14-q" id="m2q2">'+qNum(2)+q2img+'<div class="qt">Two Peptides With The Same Blocks In A Different Order Are...</div>'+H.opt('Identical',0)+H.opt('Different Peptides',1)+H.opt('Always Proteins',0)+'<div class="v14-fb">Right. The Order Is The Recipe, So A Different Order Means A Different Peptide.</div></div>'
      /* Locked notice — shown until quiz passed */
      + '<div id="m2-lock-notice" style="display:flex;align-items:center;gap:12px;padding:15px 18px;border-radius:14px;background:rgba(239,68,68,.07);border:1.5px solid rgba(239,68,68,.22);margin-top:4px;">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="width:22px;height:22px;flex-shrink:0;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
        + '<div style="flex:1;">'
          + '<div style="font-size:13px;font-weight:700;color:#ef4444;margin-bottom:2px;">Answer All Questions To Continue</div>'
          + '<div style="font-size:12px;color:#9fb0c2;">You Must Answer Every Question Correctly To Unlock The Recap.</div>'
        + '</div></div>'
      /* Try Again — shown after a wrong answer */
      + '<div id="m2-tryagain" style="display:none;align-items:center;gap:12px;padding:15px 18px;border-radius:14px;background:rgba(239,68,68,.07);border:1.5px solid rgba(239,68,68,.22);margin-top:10px;">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="width:22px;height:22px;flex-shrink:0;"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>'
        + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#ef4444;margin-bottom:2px;">Not Quite\u2014Try Again!</div><div style="font-size:12px;color:#9fb0c2;">Review The Pages Above And Try Once More.</div></div>'
        + '<button onclick="window.m2TryAgain&&window.m2TryAgain()" style="padding:10px 18px;border-radius:999px;background:linear-gradient(180deg,#f3f7fb,#cbd5e1);color:#0a1322;font-size:13px;font-weight:700;border:none;cursor:pointer;flex-shrink:0;white-space:nowrap;">Try Again</button>'
      + '</div>';

    /* ═══════════════════════════════════════════════════════
       PAGE 6 — Recap (Module 2 Completion)
    ═══════════════════════════════════════════════════════ */
    function recapCard(num, title, miniSVG, body){
      return '<div style="background:linear-gradient(180deg,#13233c,#0b1626);border:1.5px solid transparent;border-radius:16px;padding:14px;background-clip:padding-box;box-shadow:0 8px 22px rgba(0,0,0,.4);">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
          + '<div style="width:22px;height:22px;background:linear-gradient(180deg,#5ea0ff,#2463eb);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0;">'+num+'</div>'
          + '<span style="font-size:13px;font-weight:700;color:#eaf2fb;">'+title+'</span>'
        + '</div>'
        + miniSVG
        + '<p style="font-size:12px;line-height:1.5;color:#aebccb;margin:8px 0 0;">'+body+'</p>'
      + '</div>';
    }

    /* Mini visuals for each recap card */
    var rcSVG1 = '<svg viewBox="0 0 100 46" style="width:100%;height:38px;" xmlns="http://www.w3.org/2000/svg">'+sphere('A',false,22,23,16)+sphere('B',true,62,23,16)+'<line x1="38" y1="23" x2="46" y2="23" stroke="url(#v14bond)" stroke-width="6" stroke-linecap="round"/></svg>';
    var rcSVG2 = '<svg viewBox="0 0 100 46" style="width:100%;height:38px;" xmlns="http://www.w3.org/2000/svg"><line x1="14" y1="23" x2="86" y2="23" stroke="url(#v14bond)" stroke-width="8" stroke-linecap="round"/>'+sphere('A',false,14,23,14)+sphere('B',true,86,23,14)+'<rect x="40" y="12" width="20" height="22" rx="6" fill="#0a1322" stroke="#2de0d8" stroke-width="2"/><text x="50" y="26" fill="#2de0d8" font-size="10" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">C\u2261N</text></svg>';
    var rcSVG3 = '<svg viewBox="0 0 100 46" style="width:100%;height:38px;" xmlns="http://www.w3.org/2000/svg"><g class="v14-float"><circle cx="50" cy="23" r="17" fill="#2de0d8" opacity="0.88" filter="url(#v14sh)"/><text x="50" y="27" fill="#04201d" font-size="11" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">H\u2082O</text></g></svg>';
    var rcSVG4 = (function(){
      var r=11, cols=['#3B82F6','#8B5CF6','#22C55E'], s='<svg viewBox="0 0 100 50" style="width:100%;height:40px;" xmlns="http://www.w3.org/2000/svg">';
      cols.forEach(function(c,i){s+='<circle cx="'+(14+i*24)+'" cy="16" r="'+r+'" fill="'+c+'"/>';if(i<cols.length-1)s+='<line x1="'+(14+i*24+r)+'" y1="16" x2="'+(14+(i+1)*24-r)+'" y2="16" stroke="rgba(150,180,220,.4)" stroke-width="4" stroke-linecap="round"/>';});
      s+='<text x="50" y="33" fill="#aebccb" font-size="9" text-anchor="middle" font-family="Inter,sans-serif">\u2260</text>';
      var rCols=['#22C55E','#8B5CF6','#3B82F6'];
      rCols.forEach(function(c,i){s+='<circle cx="'+(14+i*24)+'" cy="44" r="'+r+'" fill="'+c+'"/>';if(i<rCols.length-1)s+='<line x1="'+(14+i*24+r)+'" y1="44" x2="'+(14+(i+1)*24-r)+'" y2="44" stroke="rgba(150,180,220,.4)" stroke-width="4" stroke-linecap="round"/>';});
      return s+'</svg>';
    })();
    var rcSVG5 = (function(){var s='<svg viewBox="0 0 110 40" style="width:100%;height:32px;" xmlns="http://www.w3.org/2000/svg">',r=5;for(var i=0;i<8;i++){s+='<circle cx="'+(r+1+i*(r*2+2))+'" cy="12" r="'+r+'" fill="#2de0d8" opacity="0.85"/>';if(i<7)s+='<line x1="'+(r+1+i*(r*2+2)+r)+'" y1="12" x2="'+(r+1+(i+1)*(r*2+2)-r)+'" y2="12" stroke="rgba(150,200,255,.35)" stroke-width="2"/>';}for(var j=0;j<7;j++){s+='<circle cx="'+(r+1+j*(r*2+2))+'" cy="28" r="'+r+'" fill="#5ea0ff" opacity="0.85"/>';if(j<6)s+='<line x1="'+(r+1+j*(r*2+2)+r)+'" y1="28" x2="'+(r+1+(j+1)*(r*2+2)-r)+'" y2="28" stroke="rgba(150,200,255,.35)" stroke-width="2"/>';}return s+'</svg>'})();
    var rcSVG6 = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">'
      +'<div style="background:rgba(0,196,188,.15);border-radius:6px;padding:4px 8px;text-align:center;"><div style="font-size:14px;font-weight:900;color:#2de0d8;">2\u201350</div><div style="font-size:9px;color:#9fb0c2;">Amino Acids</div></div>'
      +'<div style="width:1px;height:28px;background:rgba(150,170,200,.25);"></div>'
      +'<div style="background:rgba(59,130,246,.12);border-radius:6px;padding:4px 8px;text-align:center;"><div style="font-size:14px;font-weight:900;color:#7fb3ff;">51+</div><div style="font-size:9px;color:#9fb0c2;">Amino Acids</div></div>'
      +'</div>';

    /* Floating molecule SVG for header */
    var moleculeSVG = '<svg viewBox="0 0 120 110" style="width:110px;position:absolute;top:-8px;right:-8px;opacity:.9;" xmlns="http://www.w3.org/2000/svg">'
      + '<g class="v14-float">'
        + '<line x1="36" y1="50" x2="72" y2="30" stroke="url(#v14bond)" stroke-width="5" stroke-linecap="round"/>'
        + '<line x1="72" y1="30" x2="90" y2="55" stroke="url(#v14bond)" stroke-width="5" stroke-linecap="round"/>'
        + '<line x1="36" y1="50" x2="55" y2="75" stroke="url(#v14bond)" stroke-width="5" stroke-linecap="round"/>'
        + sphere('',false,36,50,14) + sphere('',true,72,30,14) + sphere('',false,90,55,14) + sphere('',true,55,75,14)
        + '<g class="v14-float"><circle cx="88" cy="22" r="12" fill="#2de0d8" opacity="0.85" filter="url(#v14sh)"/><text x="88" y="25" fill="#04201d" font-size="8" text-anchor="middle" font-weight="800" font-family="Inter,sans-serif">H\u2082O</text></g>'
        + '<path d="M82 22 L78 28" stroke="#2de0d8" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.6"/>'
      + '</g>'
      + '</svg>';

    var P6 = '<span class="v14-eyebrow">&#9679;&nbsp;Module 2 \u00b7 Recap</span>'
      /* Hero header with molecule */
      + '<div style="position:relative;min-height:90px;margin-bottom:14px;">'
        + moleculeSVG
        + '<div style="padding-right:110px;">'
          + '<h1 style="font-family:Space Grotesk,sans-serif;font-weight:800;font-size:clamp(26px,5vw,36px);line-height:1.06;margin:0 0 4px;background:linear-gradient(180deg,#ffffff,#b9c6d8 70%,#7f8ea3);-webkit-background-clip:text;background-clip:text;color:transparent;">Great Work! <svg viewBox="0 0 24 24" fill="#3B82F6" style="width:28px;height:28px;display:inline-block;vertical-align:middle;margin-top:-4px;"><circle cx="12" cy="12" r="10" fill="#3B82F6"/><path d="M8 12l3 3 5-5" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></h1>'
          + '<p style="font-size:17px;font-weight:700;color:#eaf2fb;margin:0 0 6px;">You\'ve Completed Module 2</p>'
          + '<p style="font-size:14px;color:#9fb0c2;line-height:1.55;margin:0;">Let\'s Quickly Recap Everything<br>You\'ve Learned Before Moving On.</p>'
        + '</div>'
      + '</div>'

      /* What You Learned */
      + '<div style="background:linear-gradient(180deg,#0f1f37,#0a1322);border:1.5px solid rgba(94,160,255,.18);border-radius:18px;padding:16px;margin-bottom:14px;">'
        + '<div style="font-size:15px;font-weight:800;color:#eaf2fb;margin-bottom:12px;">What You Learned</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
          + recapCard(1,'Two Amino Acids',rcSVG1,'Peptides Begin When Two Amino Acids Link Together In A Chain.')
          + recapCard(2,'Peptide Bond',rcSVG2,'The Connection That Locks Amino Acids Together Is Called A Peptide Bond.')
          + recapCard(3,'Water Release',rcSVG3,'When The Bond Forms, A Tiny Drop Of Water, H\u2082O, Is Released.')
          + recapCard(4,'Order Matters',rcSVG4,'The Same Building Blocks In A Different Order Can Make A Different Peptide.')
          + recapCard(5,'BPC-157 Example',rcSVG5,'BPC-157 Has 15 Amino Acids In One Exact Order, And Every Link Matters.')
          + recapCard(6,'Peptide Size',rcSVG6,'Peptides Are Usually 2 To 50 Amino Acids, While Proteins Are 51 Or More.')
        + '</div>'
      + '</div>'

      /* Key Takeaway */
      + '<div style="display:flex;gap:14px;align-items:center;background:linear-gradient(135deg,rgba(59,130,246,.1),rgba(0,196,188,.04));border:1.5px solid rgba(59,130,246,.28);border-radius:16px;padding:16px 18px;margin-bottom:14px;">'
        + '<div style="width:52px;height:52px;border-radius:14px;background:radial-gradient(circle at 40% 30%,#1a2c55,#0a1322);border:1px solid rgba(94,160,255,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="#5ea0ff" stroke-width="1.8" style="width:28px;height:28px;"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-5 0V4.5A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 22A2.5 2.5 0 0 1 12 19.5V7a2.5 2.5 0 0 1 5 0v12.5A2.5 2.5 0 0 1 14.5 22z"/></svg>'
        + '</div>'
        + '<div>'
          + '<div style="font-size:14px;font-weight:800;color:#7fb3ff;margin-bottom:5px;">\u2605 Key Takeaway</div>'
          + '<p style="font-size:13px;color:#cdd9e6;margin:0;line-height:1.55;">Sequence Dictates Function. A Peptide\'s Exact Order And Bonding Pattern Determine What It Does.</p>'
        + '</div>'
      + '</div>'

      /* Ask AI Assistant */
      + '<div style="display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,rgba(0,196,188,.06),rgba(59,130,246,.04));border:1.5px solid rgba(0,196,188,.2);border-radius:16px;padding:16px 18px;">'
        + '<div style="width:48px;height:48px;border-radius:50%;background:radial-gradient(circle at 40% 30%,#0f2e3a,#0a1322);border:1px solid rgba(0,196,188,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="#2de0d8" stroke-width="2" style="width:24px;height:24px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="12" cy="10" r="1" fill="#2de0d8"/><circle cx="8" cy="10" r="1" fill="#2de0d8"/><circle cx="16" cy="10" r="1" fill="#2de0d8"/></svg>'
        + '</div>'
        + '<div style="flex:1;">'
          + '<p style="font-size:13.5px;font-weight:700;color:#eaf2fb;margin:0 0 3px;">Do You Have Any Questions<br>About Anything You Just Learned?</p>'
          + '<p style="font-size:12px;color:#9fb0c2;margin:0;">Ask Our AI Assistant Anything About Peptides.</p>'
        + '</div>'
        + '<button onclick="window.location.href=\'/chat\'" style="padding:12px 18px;border-radius:999px;background:linear-gradient(135deg,#2463eb,#3B82F6);color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer;flex-shrink:0;display:flex;align-items:center;gap:7px;box-shadow:0 6px 18px rgba(59,130,246,.4);">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Ask AI Assistant'
        + '</button>'
      + '</div>';

    /* ── Register with v14 engine ── */
    H.module('s2', 2, 1, 3, labels, function(){ return [P1, P2, P3, P4, P5, P6]; });

    /* ══════════════════════════════════════════════════════
       QUIZ GATE — Block "Next" on P5 until both correct
    ══════════════════════════════════════════════════════ */
    function applyQuizGate(){
      var sc = document.getElementById('s2');
      if (!sc || !sc.getAttribute('data-v14')) return setTimeout(applyQuizGate, 80);

      /* Inject shake keyframe once */
      if (!document.getElementById('m2gate-css')){
        var st = document.createElement('style');
        st.id = 'm2gate-css';
        st.textContent = '@keyframes m2shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-7px)}30%{transform:translateX(7px)}50%{transform:translateX(-5px)}70%{transform:translateX(5px)}85%{transform:translateX(-2px)}}';
        document.head.appendChild(st);
      }

      var nextBtn   = sc.querySelector('.v14-foot .v14-next');
      var quizPage  = sc.querySelector('.v14-page[data-step="4"]'); /* P5 = index 4 */
      if (!nextBtn || !quizPage) return;

      var lockEl    = quizPage.querySelector('#m2-lock-notice');
      var tryEl     = quizPage.querySelector('#m2-tryagain');

      function allAnsweredCorrectly(){
        var qs = quizPage.querySelectorAll('.v14-q');
        for (var i = 0; i < qs.length; i++){
          if (!qs[i].getAttribute('data-done')) return false;  /* not yet answered */
          if (qs[i].querySelector('.v14-opt.wrong')) return false; /* answered wrong */
        }
        return qs.length > 0;
      }

      function anyWrong(){
        var qs = quizPage.querySelectorAll('.v14-q');
        for (var i = 0; i < qs.length; i++){
          if (qs[i].querySelector('.v14-opt.wrong')) return true;
        }
        return false;
      }

      function updateGate(){
        var onP5 = quizPage.classList.contains('on');
        if (!onP5){ nextBtn.removeAttribute('data-gated'); nextBtn.style.opacity=''; nextBtn.style.cursor=''; return; }
        if (allAnsweredCorrectly()){
          nextBtn.removeAttribute('data-gated');
          nextBtn.style.opacity = '';
          nextBtn.style.cursor  = '';
          if (lockEl) lockEl.style.display = 'none';
          if (tryEl)  tryEl.style.display  = 'none';
        } else {
          nextBtn.setAttribute('data-gated','1');
          nextBtn.style.opacity = '0.38';
          nextBtn.style.cursor  = 'not-allowed';
          if (lockEl) lockEl.style.display = anyWrong() ? 'none' : 'flex';
          if (tryEl)  tryEl.style.display  = anyWrong() ? 'flex' : 'none';
        }
      }

      /* Global Try Again handler */
      window.m2TryAgain = function(){
        quizPage.querySelectorAll('.v14-q').forEach(function(q){
          q.removeAttribute('data-done');
          q.querySelectorAll('.v14-opt').forEach(function(o){ o.classList.remove('right','wrong'); o.style.pointerEvents=''; });
          q.querySelectorAll('.v14-fb').forEach(function(fb){ fb.classList.remove('show'); });
        });
        updateGate();
      };

      /* Capture-phase intercept on Next button */
      nextBtn.addEventListener('click', function(e){
        if (quizPage.classList.contains('on') && nextBtn.getAttribute('data-gated')){
          e.stopImmediatePropagation();
          nextBtn.style.animation = 'none';
          void nextBtn.offsetHeight; /* force reflow */
          nextBtn.style.animation = 'm2shake 0.42s ease';
          setTimeout(function(){ nextBtn.style.animation = ''; }, 450);
        }
      }, true /* capture */);

      /* Re-evaluate gate after every option click */
      sc.addEventListener('click', function(e){
        if (e.target.closest('.v14-opt')) setTimeout(updateGate, 30);
      });

      /* Re-evaluate when page visibility changes (back/forward navigation) */
      var observer = new MutationObserver(updateGate);
      sc.querySelectorAll('.v14-page').forEach(function(p){
        observer.observe(p, { attributes: true, attributeFilter: ['class'] });
      });

      updateGate(); /* initial state */
    }
    setTimeout(applyQuizGate, 200);
  }
  start();
})();
