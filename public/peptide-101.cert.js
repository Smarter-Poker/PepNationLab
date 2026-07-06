/* =====================================================================
   PEPTIDE 101 - CERTIFICATE UPGRADE (screen s15)
   Replaces the static course_complete.png certificate with a real,
   dynamic, printable, engraved-style credential:
     - "Enter Your Full Name" field that auto-populates the certificate
     - guilloche rosette linework (banknote / diploma engraving)
     - embossed coin medallion with arced microtext, laurel and helix
     - champagne-foil name lettering + Cormorant serif display
     - scripted signature, ornate frame, verification microtext
     - completion date, stable credential id
     - working Copy Share Text, corrected Research Library links
       (old hotspots pointed at /library, which 404'd)

   Loaded after peptide-101.app.js / v4 / v14 by app/peptide-101/course/route.ts.
   Idempotent: safe to run more than once. No emojis. Title Case throughout.
   ===================================================================== */
(function(){
  var D = document;
  var LS = 'p101_progress_v3';

  function readState(){ try { var r = localStorage.getItem(LS); return r ? JSON.parse(r) : {}; } catch(e){ return {}; } }
  function writeState(patch){
    try { var s = readState(); for (var k in patch) s[k] = patch[k]; localStorage.setItem(LS, JSON.stringify(s)); } catch(e){}
  }
  function sanitize(v){ return (v || '').replace(/[<>]/g, '').slice(0, 44); }

  /* ---------- guilloche (hypotrochoid rosette) generator ---------- */
  function gcd(a,b){ while(b){ var t=b; b=a%b; a=t; } return a; }
  function rosette(cx, cy, R, r, d, step){
    var g = gcd(R, r), maxT = 2 * Math.PI * (r / g), k = (R - r) / r, out = [], first = true;
    for (var t = 0; t <= maxT + 0.0001; t += step){
      var x = cx + (R - r) * Math.cos(t) + d * Math.cos(k * t);
      var y = cy + (R - r) * Math.sin(t) - d * Math.sin(k * t);
      out.push((first ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1));
      first = false;
    }
    return out.join(' ') + ' Z';
  }
  function buildGuilloche(){
    var host = D.getElementById('certGuilloche');
    if (!host) return;
    var C = 300, svg = '<svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';
    svg += '<g fill="none" stroke="#2DE0D8" stroke-width="0.6">';
    svg += '<path d="' + rosette(C, C, 232, 9, 104, 0.035) + '" opacity="0.16"/>';
    svg += '<path d="' + rosette(C, C, 232, 11, 90, 0.035) + '" opacity="0.13"/>';
    svg += '<path d="' + rosette(C, C, 190, 13, 70, 0.04) + '" opacity="0.11"/>';
    svg += '<circle cx="300" cy="300" r="250" opacity="0.10"/>';
    svg += '<circle cx="300" cy="300" r="120" opacity="0.10"/>';
    svg += '</g></svg>';
    host.innerHTML = svg;
  }

  /* ---------- engraved SVG assets ---------- */
  var CORNER_SVG =
    '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
      '<path d="M2 15 L2 5 Q2 2 5 2 L15 2"/>' +
      '<path d="M8 2 L8 8 L2 8" stroke-opacity="0.6"/>' +
      '<path d="M3 22 Q11 17 15 8" stroke-opacity="0.45"/>' +
      '<circle cx="12.5" cy="12.5" r="1.7" fill="currentColor" stroke="none"/>' +
    '</svg>';

  var FLOURISH_SVG =
    '<svg viewBox="0 0 320 16" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round">' +
      '<line x1="24" y1="8" x2="146" y2="8" stroke-opacity="0.55"/>' +
      '<line x1="174" y1="8" x2="296" y2="8" stroke-opacity="0.55"/>' +
      '<circle cx="138" cy="8" r="1.6" fill="currentColor" stroke="none"/>' +
      '<circle cx="182" cy="8" r="1.6" fill="currentColor" stroke="none"/>' +
      '<path d="M160 1 l9 7 l-9 7 l-9 -7 z" fill="currentColor" stroke="none"/>' +
      '<path d="M160 4 l5.5 4 l-5.5 4 l-5.5 -4 z" fill="#0A141D" stroke="none"/>' +
    '</svg>';

  var SEAL_SVG =
    '<svg class="cert-seal" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="p101gold" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#F8EDC6"/><stop offset="0.42" stop-color="#D9BE72"/>' +
          '<stop offset="0.7" stop-color="#C9A24B"/><stop offset="1" stop-color="#8A6D2F"/>' +
        '</linearGradient>' +
        '<linearGradient id="p101teal" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#8FF5EE"/><stop offset="0.5" stop-color="#2DE0D8"/><stop offset="1" stop-color="#0A9E96"/>' +
        '</linearGradient>' +
        '<radialGradient id="p101disc" cx="50%" cy="38%" r="70%">' +
          '<stop offset="0" stop-color="#15242F"/><stop offset="1" stop-color="#050C13"/>' +
        '</radialGradient>' +
        '<path id="p101arc" d="M70 16 A54 54 0 1 1 69.99 16"/>' +
      '</defs>' +
      '<circle cx="70" cy="70" r="66" fill="none" stroke="url(#p101gold)" stroke-width="5" stroke-dasharray="1.1 4.3" stroke-linecap="round"/>' +
      '<circle cx="70" cy="70" r="61.5" fill="none" stroke="url(#p101gold)" stroke-width="1"/>' +
      '<circle cx="70" cy="70" r="49" fill="none" stroke="url(#p101gold)" stroke-width="1"/>' +
      '<text fill="#D9BE72" font-family="Inter,Arial,sans-serif" font-size="6.6" letter-spacing="1.8" font-weight="600">' +
        '<textPath href="#p101arc" xlink:href="#p101arc" startOffset="0">PEPTIDE 101 &#183; RESEARCH EDUCATION DIVISION &#183; FOUNDATIONS &#183;</textPath>' +
      '</text>' +
      '<circle cx="70" cy="70" r="47" fill="url(#p101disc)" stroke="url(#p101teal)" stroke-width="1.5"/>' +
      '<path d="M70 30 L71.8 34.6 L76.7 34.8 L72.9 37.9 L74.1 42.7 L70 40 L65.9 42.7 L67.1 37.9 L63.3 34.8 L68.2 34.6 Z" fill="url(#p101gold)"/>' +
      '<g fill="none" stroke="url(#p101teal)" stroke-width="2" stroke-linecap="round">' +
        '<path d="M63 53 C77 60, 77 64, 63 70 C49 76, 49 80, 63 87"/>' +
        '<path d="M77 53 C63 60, 63 64, 77 70 C91 76, 91 80, 77 87"/>' +
        '<path d="M66 56 L74 56" stroke-width="1.5" opacity="0.85"/>' +
        '<path d="M64 63 L76 63" stroke-width="1.5" opacity="0.85"/>' +
        '<path d="M64 77 L76 77" stroke-width="1.5" opacity="0.85"/>' +
        '<path d="M66 84 L74 84" stroke-width="1.5" opacity="0.85"/>' +
      '</g>' +
      '<g fill="none" stroke="url(#p101gold)" stroke-width="1.5" stroke-linecap="round">' +
        '<path d="M70 101 C56 97, 48 88, 47 74"/>' +
        '<path d="M65 97 L59 100"/><path d="M58 92 L51 94"/><path d="M53 86 L46 87"/><path d="M49 80 L42 80"/><path d="M47 74 L40 72"/>' +
        '<path d="M70 101 C84 97, 92 88, 93 74"/>' +
        '<path d="M75 97 L81 100"/><path d="M82 92 L89 94"/><path d="M87 86 L94 87"/><path d="M91 80 L98 80"/><path d="M93 74 L100 72"/>' +
      '</g>' +
    '</svg>';

  /* ---------- markup ---------- */
  var CERT_HTML =
    '<style>' +
    '@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Pinyon+Script&display=swap");' +
    '#s15 .cert-wrap{max-width:840px;margin:0 auto;padding:28px 16px 64px;}' +
    '@media (max-width:800px){#s15 .cert-wrap{padding:14px 10px 54px;}}' +
    '#s15 .cert-card{position:relative;isolation:isolate;border-radius:8px;padding:8px;' +
      'background:linear-gradient(180deg,#0C1A24 0%,#060D15 100%);' +
      'box-shadow:0 40px 90px rgba(0,0,0,0.6),0 2px 0 rgba(255,255,255,0.04) inset;overflow:hidden;}' +
    '#s15 .cert-guilloche{position:absolute;inset:0;z-index:0;opacity:0.9;pointer-events:none;' +
      '-webkit-mask-image:radial-gradient(circle at 50% 42%,#000 0%,#000 46%,transparent 78%);' +
      'mask-image:radial-gradient(circle at 50% 42%,#000 0%,#000 46%,transparent 78%);}' +
    '#s15 .cert-guilloche svg{width:100%;height:100%;display:block;}' +
    '#s15 .cert-frame{position:relative;z-index:1;border:1px solid rgba(201,162,75,0.55);border-radius:5px;' +
      'padding:44px 40px 30px;background:' +
      'radial-gradient(140% 90% at 50% -10%,rgba(0,196,188,0.10),transparent 55%),' +
      'radial-gradient(120% 80% at 50% 115%,rgba(201,162,75,0.07),transparent 55%);}' +
    '#s15 .cert-frame::before{content:"";position:absolute;inset:6px;border:1px solid rgba(150,168,192,0.18);border-radius:3px;pointer-events:none;}' +
    '@media (max-width:640px){#s15 .cert-frame{padding:34px 20px 26px;}}' +
    '#s15 .cert-corner{position:absolute;width:40px;height:40px;z-index:3;color:#C9A24B;opacity:0.85;}' +
    '#s15 .cert-corner svg{width:100%;height:100%;display:block;}' +
    '#s15 .cert-corner.tl{top:12px;left:12px;}' +
    '#s15 .cert-corner.tr{top:12px;right:12px;transform:scaleX(-1);}' +
    '#s15 .cert-corner.bl{bottom:12px;left:12px;transform:scaleY(-1);}' +
    '#s15 .cert-corner.br{bottom:12px;right:12px;transform:scale(-1,-1);}' +
    '#s15 .cert-body-z{position:relative;z-index:2;text-align:center;}' +
    '#s15 .cert-microtop,#s15 .cert-microbottom{font-family:Inter,sans-serif;font-size:9px;letter-spacing:5px;' +
      'color:rgba(153,177,182,0.7);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '#s15 .cert-microtop{margin-bottom:14px;}' +
    '#s15 .cert-seal{width:132px;height:132px;margin:2px auto 12px;display:block;filter:drop-shadow(0 6px 14px rgba(0,0,0,0.55));}' +
    '#s15 .cert-kicker{font-family:Inter,sans-serif;font-size:11px;letter-spacing:6px;color:#2DE0D8;font-weight:600;text-transform:uppercase;}' +
    '#s15 .cert-title{font-family:"Cormorant Garamond",serif;font-weight:700;font-size:clamp(40px,9vw,66px);line-height:1;margin:2px 0 0;' +
      'background:linear-gradient(180deg,#8FF5EE 0%,#2DE0D8 42%,#08A79E 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;}' +
    '#s15 .cert-sub{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:clamp(16px,2.6vw,20px);color:#AEBDC9;margin-top:2px;letter-spacing:0.4px;}' +
    '#s15 .cert-awardline{font-family:"Pinyon Script",cursive;font-size:clamp(24px,5vw,34px);color:#C9A24B;line-height:1;margin:18px 0 2px;}' +
    '#s15 .cert-name{font-family:"Cormorant Garamond",serif;font-weight:700;font-size:clamp(34px,8.4vw,60px);line-height:1.04;margin:2px 0 2px;word-break:break-word;letter-spacing:0.5px;' +
      'background:linear-gradient(176deg,#FBF3D2 0%,#EAD59B 24%,#D9BE72 44%,#C9A24B 60%,#9C7B34 78%,#E7CE8E 100%);' +
      '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;filter:drop-shadow(0 1px 0 rgba(0,0,0,0.55));}' +
    '#s15 .cert-name.is-placeholder{background:none;-webkit-text-fill-color:#7C8A99;color:#7C8A99;filter:none;font-style:italic;font-weight:600;opacity:0.85;}' +
    '#s15 .cert-flourish{width:min(320px,80%);height:16px;margin:8px auto 16px;color:#C9A24B;}' +
    '#s15 .cert-flourish svg{width:100%;height:100%;display:block;}' +
    '#s15 .cert-copy{font-family:Inter,sans-serif;font-size:13.5px;line-height:1.8;color:#B9C6D3;max-width:560px;margin:0 auto 20px;}' +
    '#s15 .cert-meta{display:flex;align-items:center;justify-content:center;gap:0;flex-wrap:wrap;margin:2px auto 0;}' +
    '#s15 .cert-meta .col{padding:0 26px;text-align:center;}' +
    '#s15 .cert-meta .sep{width:1px;height:34px;background:linear-gradient(180deg,transparent,rgba(201,162,75,0.5),transparent);}' +
    '#s15 .cert-meta .lbl{display:block;font-family:Inter,sans-serif;font-size:9.5px;letter-spacing:3px;text-transform:uppercase;color:#8496A6;margin-bottom:4px;}' +
    '#s15 .cert-meta .val{display:block;font-family:"Cormorant Garamond",serif;font-size:19px;font-weight:600;color:#D8E2EC;letter-spacing:0.4px;}' +
    '#s15 .cert-sign{display:flex;justify-content:center;margin:24px auto 4px;}' +
    '#s15 .cert-sign .box{width:min(280px,72%);text-align:center;}' +
    '#s15 .cert-sign .script{font-family:"Pinyon Script",cursive;font-size:30px;color:#D8E2EC;line-height:0.9;margin-bottom:2px;}' +
    '#s15 .cert-sign .rule{height:1px;background:linear-gradient(90deg,transparent,rgba(150,168,192,0.55),transparent);margin:2px 0 7px;}' +
    '#s15 .cert-sign .cap{font-family:Inter,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8496A6;}' +
    '#s15 .cert-microbottom{margin-top:18px;}' +
    '#s15 .cert-name-row{max-width:460px;margin:26px auto 4px;text-align:left;}' +
    '#s15 .cert-name-row label{display:block;font-family:Inter,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#93A3B4;font-weight:600;margin-bottom:9px;}' +
    '#s15 .cert-name-input{width:100%;box-sizing:border-box;min-height:52px;padding:13px 16px;font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:600;color:#F4EAC8;background:rgba(201,162,75,0.05);border:1px solid rgba(201,162,75,0.32);border-radius:12px;outline:none;transition:border-color 0.15s,box-shadow 0.15s,background 0.15s;}' +
    '#s15 .cert-name-input::placeholder{color:rgba(148,150,166,0.6);font-style:italic;font-weight:500;}' +
    '#s15 .cert-name-input:focus{border-color:#C9A24B;background:rgba(201,162,75,0.09);box-shadow:0 0 0 3px rgba(201,162,75,0.16);}' +
    '#s15 .cert-name-hint{font-family:Inter,sans-serif;font-size:12px;color:#8496A6;margin-top:9px;}' +
    '#s15 .cert-actions{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:20px auto 0;max-width:500px;}' +
    '#s15 .cert-actions .btn{flex:1 1 200px;min-height:52px;}' +
    '#s15 .cert-keepgoing{margin:30px auto 0;max-width:640px;text-align:center;}' +
    '#s15 .cert-keepgoing h3{font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:700;color:#D8E2EC;margin-bottom:4px;}' +
    '#s15 .cert-keepgoing p{font-family:Inter,sans-serif;font-size:13px;color:#93A3B4;margin-bottom:14px;}' +
    '#s15 .cert-links{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}' +
    '#s15 .cert-link{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;font-family:Inter,sans-serif;font-size:13px;font-weight:600;color:#2DE0D8;text-decoration:none;background:rgba(0,196,188,0.08);border:1px solid rgba(0,196,188,0.25);border-radius:999px;transition:background 0.15s,transform 0.15s;}' +
    '#s15 .cert-link:hover{background:rgba(0,196,188,0.16);transform:translateY(-1px);}' +
    '#s15 .cert-link svg{width:16px;height:16px;}' +
    '#s15 .cert-restart{margin:20px auto 0;text-align:center;}' +
    '@media print{' +
      'body *{visibility:hidden !important;}' +
      '#s15,#s15 *{visibility:visible !important;}' +
      '#s15 .cert-name-row,#s15 .cert-actions,#s15 .cert-keepgoing,#s15 .cert-restart,#s15 .cert-name-hint{display:none !important;}' +
      '#s15{position:absolute !important;inset:0 !important;margin:0 !important;}' +
      '#s15 .cert-wrap{max-width:100% !important;padding:0 !important;}' +
      '#s15 .cert-card{box-shadow:none !important;background:#060D15 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-radius:0 !important;}' +
      '#s15 .cert-frame,#s15 .cert-guilloche,#s15 .cert-seal,#s15 .cert-corner{-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
      '#s15 .cert-title{-webkit-text-fill-color:#2DE0D8 !important;color:#2DE0D8 !important;background:none !important;}' +
      '#s15 .cert-name{-webkit-text-fill-color:#C9A24B !important;color:#C9A24B !important;background:none !important;filter:none !important;}' +
    '}' +
    '</style>' +
    '<div class="cert-wrap">' +
      '<div class="cert-card" id="p101CertCard" role="img" aria-label="Peptide 101 Certificate Of Completion">' +
        '<div class="cert-guilloche" id="certGuilloche" aria-hidden="true"></div>' +
        '<span class="cert-corner tl">' + CORNER_SVG + '</span>' +
        '<span class="cert-corner tr">' + CORNER_SVG + '</span>' +
        '<span class="cert-corner bl">' + CORNER_SVG + '</span>' +
        '<span class="cert-corner br">' + CORNER_SVG + '</span>' +
        '<div class="cert-frame">' +
          '<div class="cert-body-z">' +
            '<div class="cert-microtop">Research &#183; Education &#183; Peptide Science &#183; Certified &#183; Research Use Only</div>' +
            SEAL_SVG +
            '<div class="cert-kicker">Certificate Of Completion</div>' +
            '<div class="cert-title">Peptide 101</div>' +
            '<div class="cert-sub">Foundations Of Peptide Research</div>' +
            '<div class="cert-awardline">This Is Awarded To</div>' +
            '<div class="cert-name is-placeholder" id="certNameOn">Your Name</div>' +
            '<div class="cert-flourish">' + FLOURISH_SVG + '</div>' +
            '<p class="cert-copy">Having Completed All 14 Modules And The Final Knowledge Check, ' +
              'Covering Peptide Biology, Mechanisms Of Action, Peptide Families, Stacking Frameworks, ' +
              'Reconstitution, Dosing, And Safety And Sourcing.</p>' +
            '<div class="cert-meta">' +
              '<div class="col"><span class="lbl">Completed</span><span class="val" id="certDate">Today</span></div>' +
              '<div class="sep"></div>' +
              '<div class="col"><span class="lbl">Credential</span><span class="val" id="certId">PNL-P101</span></div>' +
            '</div>' +
            '<div class="cert-sign">' +
              '<div class="box">' +
                '<div class="script">PepNationLab</div>' +
                '<div class="rule"></div>' +
                '<div class="cap">Research Education Division</div>' +
              '</div>' +
            '</div>' +
            '<div class="cert-microbottom">Verified Credential &#183; Research Use Only &#183; Not Medical Advice</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cert-name-row">' +
        '<label for="certNameInput">Enter Your Full Name (Appears On The Certificate)</label>' +
        '<input type="text" id="certNameInput" class="cert-name-input" maxlength="44" ' +
          'placeholder="Enter Your Full Name" autocomplete="name" spellcheck="false" />' +
        '<div class="cert-name-hint">Type Your Name, Then Print Or Save Your Certificate.</div>' +
      '</div>' +
      '<div class="cert-actions">' +
        '<button class="btn btn-primary" id="certPrintBtn" aria-label="Print Or Save Certificate">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
          'Print Certificate</button>' +
        '<button class="btn btn-ghost" id="copyBtn" aria-label="Copy Share Text">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
          'Copy Share Text</button>' +
      '</div>' +
      '<div class="cert-keepgoing">' +
        '<h3>Keep Going</h3>' +
        '<p>You Have The Foundations. Explore Real Compounds In The Research Library.</p>' +
        '<div class="cert-links">' +
          '<a class="cert-link" href="/research/compounds/bpc-157"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/></svg>BPC-157</a>' +
          '<a class="cert-link" href="/research/compounds/tb-500"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/></svg>TB-500</a>' +
          '<a class="cert-link" href="/research/compounds/ipamorelin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/></svg>Ipamorelin</a>' +
          '<a class="cert-link" href="/research/compounds/ghk-cu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/></svg>GHK-Cu</a>' +
          '<a class="cert-link" href="/research/a-z"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>Browse The Full A-Z Library</a>' +
        '</div>' +
      '</div>' +
      '<div class="cert-restart">' +
        '<button class="btn btn-ghost" id="certRestartBtn" aria-label="Restart Course">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3.5 12a8.5 8.5 0 1 1 2.5 6"/><path d="M3 21v-5h5"/></svg>' +
          'Restart Course</button>' +
      '</div>' +
    '</div>' +
    '<div id="shareText" style="display:none;">' +
      'I Completed Peptide 101 - Foundations Of Peptide Research On PepNationLab. 14 Modules Covering Peptide Biology, ' +
      'Mechanisms Of Action, The GH Axis, Reconstitution Techniques, And Peptide Family Categories. ' +
      '#PepNationLab #PeptideResearch #ResearchEducation' +
    '</div>';

  function setCertName(v){
    v = sanitize(v);
    var on = D.getElementById('certNameOn');
    if (on) {
      if (v.trim()) { on.textContent = v; on.classList.remove('is-placeholder'); }
      else { on.textContent = 'Your Name'; on.classList.add('is-placeholder'); }
    }
    writeState({ name: v });
  }

  function printCertificate(){
    var inp = D.getElementById('certNameInput');
    if (inp && !inp.value.trim()) {
      inp.focus();
      inp.style.borderColor = '#EAB308';
      inp.setAttribute('placeholder', 'Please Enter Your Name First');
      setTimeout(function(){ inp.style.borderColor = ''; }, 1800);
      return;
    }
    try { window.print(); } catch(e){}
  }

  function copyShareText(){
    if (typeof window.copyShare === 'function') { try { window.copyShare(); return; } catch(e){} }
    var elx = D.getElementById('shareText');
    var btn = D.getElementById('copyBtn');
    if (!elx || !btn) return;
    var text = (elx.textContent || '').trim();
    var restore = btn.innerHTML;
    var done = function(){ btn.innerHTML = 'Copied To Clipboard'; setTimeout(function(){ btn.innerHTML = restore; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function(){ btn.textContent = 'Use Long-Press To Copy'; });
    } else { btn.textContent = 'Use Long-Press To Copy'; }
  }

  function goHomeSafe(){
    if (typeof window.goHome === 'function') { try { window.goHome(); return; } catch(e){} }
    window.location.href = '/peptide-101';
  }

  function initValues(){
    var d = D.getElementById('certDate');
    if (d) d.textContent = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    var idEl = D.getElementById('certId');
    if (idEl) {
      var st = readState();
      if (!st.certId) {
        st.certId = 'PNL-P101-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
        writeState({ certId: st.certId });
      }
      idEl.textContent = st.certId;
    }
    var saved = sanitize(readState().name);
    var inp = D.getElementById('certNameInput');
    if (inp && saved.trim()) inp.value = saved;
    setCertName(saved);
  }

  /* Replace the static-image s15 with the engraved certificate. Idempotent. */
  function upgrade(){
    var s15 = D.getElementById('s15');
    if (!s15) return false;
    if (s15.getAttribute('data-cert-upgraded') === '2') return true;

    s15.innerHTML = CERT_HTML;
    s15.setAttribute('data-cert-upgraded', '2');
    s15.style.padding = '0';
    s15.style.background = 'transparent';

    buildGuilloche();

    var inp = D.getElementById('certNameInput');
    if (inp) inp.addEventListener('input', function(){ setCertName(inp.value); });
    var pb = D.getElementById('certPrintBtn'); if (pb) pb.addEventListener('click', printCertificate);
    var cb = D.getElementById('copyBtn'); if (cb) cb.addEventListener('click', copyShareText);
    var rb = D.getElementById('certRestartBtn'); if (rb) rb.addEventListener('click', goHomeSafe);

    initValues();
    return true;
  }

  function boot(){
    if (upgrade()) return;
    var n = 0, t = setInterval(function(){ if (upgrade() || n++ > 200) clearInterval(t); }, 50);
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
