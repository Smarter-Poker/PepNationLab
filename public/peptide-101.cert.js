/* =====================================================================
   PEPTIDE 101 - CERTIFICATE UPGRADE (screen s15)
   Replaces the static course_complete.png certificate with a real,
   dynamic, printable certificate: a "Enter Your Full Name" field that
   auto-populates the certificate, a completion date, a stable credential
   id, a print-clean layout, working Copy Share Text, and corrected
   Research Library links (the old hotspots pointed at /library, which
   does not exist and 404'd).

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
  function sanitize(v){ return (v || '').replace(/[<>]/g, '').slice(0, 48); }

  var CERT_HTML =
    '<style>' +
    '#s15 .cert-wrap{max-width:760px;margin:0 auto;padding:24px 16px 64px;}' +
    '@media (max-width:800px){#s15 .cert-wrap{padding:16px 12px 56px;}}' +
    '#s15 .cert-card{position:relative;border-radius:22px;padding:40px 34px 34px;text-align:center;color:var(--silver);' +
      'background:radial-gradient(120% 90% at 15% 0%,rgba(0,196,188,0.10) 0%,rgba(0,196,188,0) 55%),' +
      'radial-gradient(120% 90% at 85% 100%,rgba(59,130,246,0.10) 0%,rgba(59,130,246,0) 55%),' +
      'linear-gradient(180deg,#0C1723 0%,#070E18 100%);' +
      'border:1px solid rgba(150,168,192,0.20);box-shadow:0 26px 60px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.05);overflow:hidden;}' +
    '#s15 .cert-card::before{content:"";position:absolute;inset:10px;border-radius:16px;border:1px solid rgba(0,196,188,0.22);pointer-events:none;}' +
    '#s15 .cert-corner{position:absolute;width:42px;height:42px;opacity:0.55;pointer-events:none;}' +
    '#s15 .cert-corner.tl{top:16px;left:16px;border-top:2px solid var(--teal);border-left:2px solid var(--teal);border-top-left-radius:10px;}' +
    '#s15 .cert-corner.tr{top:16px;right:16px;border-top:2px solid var(--teal);border-right:2px solid var(--teal);border-top-right-radius:10px;}' +
    '#s15 .cert-corner.bl{bottom:16px;left:16px;border-bottom:2px solid var(--teal);border-left:2px solid var(--teal);border-bottom-left-radius:10px;}' +
    '#s15 .cert-corner.br{bottom:16px;right:16px;border-bottom:2px solid var(--teal);border-right:2px solid var(--teal);border-bottom-right-radius:10px;}' +
    '#s15 .cert-seal{width:74px;height:74px;margin:0 auto 14px;display:block;}' +
    '#s15 .cert-kicker{font-size:11px;letter-spacing:4px;color:var(--muted);font-weight:600;}' +
    "#s15 .cert-title{font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:800;color:var(--teal-l);margin:6px 0 2px;letter-spacing:0.5px;}" +
    '#s15 .cert-sub{font-size:14px;color:var(--muted);margin-bottom:18px;}' +
    '#s15 .cert-awarded{font-size:11px;letter-spacing:4px;color:var(--muted);font-weight:600;}' +
    "#s15 .cert-name{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:clamp(28px,7vw,46px);line-height:1.1;margin:6px 0 4px;color:#FFFFFF;word-break:break-word;background:linear-gradient(90deg,#FFFFFF 0%,#D0DAE4 100%);-webkit-background-clip:text;background-clip:text;}" +
    '#s15 .cert-name.is-placeholder{color:var(--muted);opacity:0.65;-webkit-text-fill-color:var(--muted);}' +
    '#s15 .cert-rule{width:120px;height:2px;margin:10px auto 16px;border:0;background:linear-gradient(90deg,rgba(0,196,188,0) 0%,var(--teal) 50%,rgba(0,196,188,0) 100%);}' +
    '#s15 .cert-body{font-size:14px;line-height:1.7;color:var(--silver);max-width:560px;margin:0 auto 18px;}' +
    '#s15 .cert-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 26px;margin-top:6px;}' +
    '#s15 .cert-meta div{font-size:12.5px;color:var(--muted);}' +
    '#s15 .cert-meta strong{color:var(--silver);font-weight:600;}' +
    '#s15 .cert-issuer{margin-top:4px;font-size:12.5px;color:var(--muted);}' +
    '#s15 .cert-name-row{max-width:440px;margin:22px auto 4px;text-align:left;}' +
    '#s15 .cert-name-row label{display:block;font-size:12px;letter-spacing:0.5px;color:var(--muted);font-weight:600;margin-bottom:8px;}' +
    '#s15 .cert-name-input{width:100%;box-sizing:border-box;min-height:50px;padding:12px 16px;font-size:16px;color:#FFFFFF;background:rgba(255,255,255,0.04);border:1px solid rgba(150,168,192,0.28);border-radius:12px;outline:none;transition:border-color 0.15s,box-shadow 0.15s;}' +
    '#s15 .cert-name-input::placeholder{color:rgba(168,180,192,0.6);}' +
    '#s15 .cert-name-input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,196,188,0.16);}' +
    '#s15 .cert-name-hint{font-size:12px;color:var(--muted);margin-top:8px;}' +
    '#s15 .cert-actions{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:22px auto 0;max-width:480px;}' +
    '#s15 .cert-actions .btn{flex:1 1 200px;min-height:50px;}' +
    "#s15 .cert-keepgoing{margin:26px auto 0;max-width:620px;text-align:center;}" +
    "#s15 .cert-keepgoing h3{font-family:'Space Grotesk',sans-serif;font-size:16px;color:var(--silver);margin-bottom:4px;}" +
    '#s15 .cert-keepgoing p{font-size:13px;color:var(--muted);margin-bottom:14px;}' +
    '#s15 .cert-links{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}' +
    '#s15 .cert-link{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;font-size:13px;font-weight:600;color:var(--teal);text-decoration:none;background:rgba(0,196,188,0.08);border:1px solid rgba(0,196,188,0.25);border-radius:999px;transition:background 0.15s,transform 0.15s;}' +
    '#s15 .cert-link:hover{background:rgba(0,196,188,0.16);transform:translateY(-1px);}' +
    '#s15 .cert-link svg{width:16px;height:16px;}' +
    '#s15 .cert-restart{margin:22px auto 0;text-align:center;}' +
    '@media print{' +
      'body *{visibility:hidden !important;}' +
      '#s15,#s15 *{visibility:visible !important;}' +
      '#s15 .cert-name-row,#s15 .cert-actions,#s15 .cert-keepgoing,#s15 .cert-restart,#s15 .cert-name-hint{display:none !important;}' +
      '#s15{position:absolute !important;inset:0 !important;margin:0 !important;}' +
      '#s15 .cert-wrap{max-width:100% !important;padding:0 !important;}' +
      '#s15 .cert-card{box-shadow:none !important;border:2px solid #00C4BC !important;background:#070E18 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-radius:0 !important;min-height:96vh;display:flex;flex-direction:column;justify-content:center;}' +
      '#s15 .cert-name{-webkit-text-fill-color:#FFFFFF !important;color:#FFFFFF !important;}' +
    '}' +
    '</style>' +
    '<div class="cert-wrap">' +
      '<div class="cert-card" id="p101CertCard" role="img" aria-label="Peptide 101 Certificate Of Completion">' +
        '<span class="cert-corner tl"></span><span class="cert-corner tr"></span>' +
        '<span class="cert-corner bl"></span><span class="cert-corner br"></span>' +
        '<svg class="cert-seal" viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
          '<path d="M32 3l24 9v14c0 15-10.5 23.5-24 28C18.5 49.5 8 41 8 26V12z" fill="rgba(0,196,188,0.10)" stroke="#00C4BC" stroke-width="2"/>' +
          '<path d="M22 31l7 7 14-15" stroke="#2DE0D8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
        '<div class="cert-kicker">CERTIFICATE OF COMPLETION</div>' +
        '<div class="cert-title">Peptide 101</div>' +
        '<div class="cert-sub">Foundations Of Peptide Research</div>' +
        '<div class="cert-awarded">AWARDED TO</div>' +
        '<div class="cert-name is-placeholder" id="certNameOn">Your Name</div>' +
        '<hr class="cert-rule" />' +
        '<p class="cert-body">This Certifies The Completion Of All 14 Modules And The Final Knowledge Check, ' +
          'Covering Peptide Biology, Mechanisms Of Action, Peptide Families, Stacking Frameworks, ' +
          'Reconstitution, Dosing, And Safety And Sourcing.</p>' +
        '<div class="cert-meta">' +
          '<div><strong>Completed:</strong> <span id="certDate">Today</span></div>' +
          '<div><strong>Credential:</strong> <span id="certId">PNL-P101</span></div>' +
        '</div>' +
        '<div class="cert-issuer">PepNationLab, Research Education Division</div>' +
      '</div>' +
      '<div class="cert-name-row">' +
        '<label for="certNameInput">Enter Your Full Name (Appears On The Certificate)</label>' +
        '<input type="text" id="certNameInput" class="cert-name-input" maxlength="48" ' +
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

  /* Copy share text. Reuses the page-level copyShare() if present; otherwise
     provides a self-contained fallback so the button always works. */
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

  /* Replace the static-image s15 with the dynamic certificate. Idempotent. */
  function upgrade(){
    var s15 = D.getElementById('s15');
    if (!s15) return false;
    if (s15.getAttribute('data-cert-upgraded') === '1') return true;

    s15.innerHTML = CERT_HTML;
    s15.setAttribute('data-cert-upgraded', '1');
    s15.style.padding = '0';
    s15.style.background = 'transparent';

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
