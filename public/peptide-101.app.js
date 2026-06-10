// =====================================================
// STATE
// =====================================================
const totalScreens = 11;
let curScreen = 0;
let sortCol = -1, sortDir = 1;

const doseData = [
  ["BPC-157",      "200-500 mcg",  "1-2x Daily",   "~4 hrs",     "Sub-Q Or IM"],
  ["TB-500",       "2.0-2.5 mg",   "2x Weekly",    "~72 hrs",    "Sub-Q"],
  ["PT-141",       "1-2 mg",       "As Needed",    "~2-3 hrs",   "Sub-Q Or Intranasal"],
  ["Sermorelin",   "100-300 mcg",  "Nightly",      "10-20 min",  "Sub-Q"],
  ["CJC-1295 DAC", "1-2 mg",       "1-2x Weekly",  "6-8 Days",   "Sub-Q"],
  ["Ipamorelin",   "100-300 mcg",  "Nightly",      "~2 hrs",     "Sub-Q"],
  ["AOD-9604",     "200-500 mcg",  "Daily",        "~30 min",    "Sub-Q"],
  ["GHK-Cu",       "1-2 mg",       "3-5x Weekly",  "~1 hr",      "Sub-Q Or Topical"],
];

const glossaryTerms = [
  { term: "Amino Acid", def: "The Tiny Building Blocks That Make Up Peptides, Like LEGO Bricks. There Are 20 Basic Kinds, And The Order You Snap Them Together Decides What The Peptide Does." },
  { term: "Angiogenesis", def: "Growing New Tiny Blood Vessels. More Blood Vessels Can Help An Area Heal. Some Peptides Are Studied For This." },
  { term: "Bacteriostatic Water (BAC Water)", def: "Clean Water With A Tiny Bit Of Alcohol In It. The Alcohol Stops Germs From Growing, So Liquid Peptides Stay Good For About 4 Weeks." },
  { term: "Conformation", def: "The 3D Shape A Peptide Folds Into. Shape Is Everything. A Peptide Only Works If Its Shape Fits The Lock It Was Made For." },
  { term: "Cyclical Peptide", def: "A Peptide Whose Chain Loops Around Into A Ring Instead Of A Straight Line. Rings Are Often Tougher And Last Longer. PT-141 Is One." },
  { term: "Fibroblast", def: "A Repair Cell. It Makes Collagen, The Stuff That Holds Skin And Tissue Together. Important For Healing." },
  { term: "GHRH", def: "A Natural Signal In Your Brain That Tells The Body To Make Growth Hormone. Some Peptides Copy This Signal." },
  { term: "GHS-R1a", def: "One Of The Locks In The Body That Turns On Growth Hormone. Peptides Like Ipamorelin Are Keys That Fit It." },
  { term: "Half-Life", def: "How Long Something Lasts In The Body Before Half Of It Is Gone. Short Half-Life Means You Use It More Often. Long Means Less Often." },
  { term: "IGF-1", def: "A Growth Signal Your Liver Makes After Growth Hormone Shows Up. A Lot Of Growth Hormone's Effects Actually Come From IGF-1." },
  { term: "Lyophilization", def: "A Fancy Word For Freeze-Drying. The Water Is Pulled Out, Leaving A Dry Powder That Lasts A Long Time. Same Idea As Freeze-Dried Fruit." },
  { term: "Melanocortin Receptor", def: "A Group Of Locks In The Body Linked To Skin Color, Appetite, And Some Brain Signals. Peptides Like PT-141 Fit These Locks." },
  { term: "Peptide Bond", def: "The Strong Connection That Holds Two Building Blocks Together, Like Super Glue Between LEGO Bricks. A Tiny Drop Of Water Pops Out When It Forms." },
  { term: "Pituitary Gland", def: "A Tiny Gland At The Base Of Your Brain. It Acts Like A Control Center, Releasing Many Signals Including Growth Hormone." },
  { term: "Reconstitution", def: "Adding Water To Dry Peptide Powder To Turn It Into A Liquid. It Just Means Make It Liquid Again." },
  { term: "Somatotroph", def: "The Special Cells In Your Brain's Pituitary Gland That Make Growth Hormone." },
  { term: "Sub-Q (Subcutaneous)", def: "Putting Something Into The Soft Fatty Layer Just Under The Skin. It Is The Most Common Way Peptides Are Used In Studies." },
  { term: "Thymosin Beta-4 (TB4)", def: "A Natural Protein Found In Almost Every Cell In The Body. TB-500 Is A Lab-Made Piece Of It. It Helps Cells Move And Repair." },
];

// =====================================================
// DYNAMIC COURSE NAV
// =====================================================
function courseGo(n, el){
  document.querySelectorAll('.course-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  if (typeof goTo === 'function') goTo(n);
}

// =====================================================
// NAVIGATION
// =====================================================
function goTo(n) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("s" + n).classList.add("active");
  curScreen = n;
  updateProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
  saveProgress();
  if (n === 10) {
    const d = document.getElementById("certDate");
    if (d) d.textContent = "Completed: " + new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  if (n === 9) renderDoseTable();
}

function updateProgress() {
  const pct = Math.round((curScreen / (totalScreens - 1)) * 100);
  const fill = document.getElementById("progFill");
  const label = document.getElementById("progLabel");
  if (fill) fill.style.width = pct + "%";
  if (label) label.textContent = pct + "%";
}

// Keyboard navigation
document.addEventListener("keydown", function(e) {
  const modal = document.getElementById("glossaryModal");
  if (modal && modal.style.display !== "none") return;
  if (e.key === "ArrowRight" && curScreen < totalScreens - 1) goTo(curScreen + 1);
  if (e.key === "ArrowLeft" && curScreen > 0) goTo(curScreen - 1);
});

// =====================================================
// PROGRESS PERSISTENCE
// =====================================================
function saveProgress() {
  try { localStorage.setItem("p101_screen", curScreen); } catch(e) {}
}
function loadProgress() {
  try {
    const s = parseInt(localStorage.getItem("p101_screen") || "0");
    if (s > 0 && s < totalScreens) goTo(s);
  } catch(e) {}
}

// =====================================================
// QUIZ
// =====================================================
function quiz(qid, btn, correct) {
  const parent = btn.closest(".quiz-opts");
  if (!parent || parent.classList.contains("locked")) return;
  parent.classList.add("locked");
  const fb = document.getElementById(qid + "-fb");
  if (correct) {
    btn.classList.add("correct");
    if (fb) { fb.textContent = "Correct!"; fb.style.color = "var(--green)"; }
  } else {
    btn.classList.add("wrong");
    if (fb) { fb.textContent = "Not Quite. Review The Highlighted Answer."; fb.style.color = "var(--red)"; }
    parent.querySelectorAll(".quiz-opt").forEach(b => {
      if (b.getAttribute("onclick") && b.getAttribute("onclick").includes(",true)")) b.classList.add("correct");
    });
  }
}

// =====================================================
// CHAIN BUILDER
// =====================================================
let chainSeq = [];

function addAA(name) {
  if (chainSeq.length >= 12) chainSeq = [];
  chainSeq.push(name);
  renderChain();
}

function clearChain() {
  chainSeq = [];
  renderChain();
}

function renderChain() {
  const area = document.getElementById("chainArea");
  const info = document.getElementById("chainInfo");
  const lenEl = document.getElementById("chainLen");
  const typeEl = document.getElementById("chainType");
  if (!area) return;

  if (chainSeq.length === 0) {
    area.innerHTML = '<span style="font-size:13px;color:var(--muted);">Add Amino Acids Below To Build Your Chain...</span>';
    if (info) info.style.display = "none";
    return;
  }

  let html = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:4px;">';
  chainSeq.forEach((aa, i) => {
    if (i > 0) {
      html += '<span style="color:var(--teal);font-size:16px;font-weight:700;line-height:1;">-</span>';
    }
    html += `<span style="background:rgba(0,196,188,0.2);border:1.5px solid var(--teal);border-radius:8px;padding:4px 8px;font-size:12px;font-weight:600;color:var(--teal);">${aa}</span>`;
  });
  html += '</div>';
  area.innerHTML = html;

  if (info) info.style.display = "block";
  if (lenEl) lenEl.textContent = chainSeq.length;
  if (typeEl) {
    if (chainSeq.length <= 1) typeEl.textContent = "(Monomer)";
    else if (chainSeq.length <= 10) typeEl.textContent = "(Oligopeptide)";
    else typeEl.textContent = "(Polypeptide)";
  }
}

// =====================================================
// LOCK-KEY BINDING DEMO
// =====================================================
let boundState = false;

function bindPeptide() {
  if (boundState) return;
  boundState = true;
  const p = document.getElementById("lkPeptide");
  const r = document.getElementById("lkReceptor");
  const effect = document.getElementById("lkEffect");
  const instr = document.getElementById("lkInstr");
  if (p) { p.style.transform = "translateY(-20px) scale(0.85)"; p.style.transition = "all 0.5s ease"; }
  setTimeout(() => {
    if (r) { r.style.borderColor = "var(--teal)"; r.style.background = "rgba(0,196,188,0.2)"; }
    if (instr) instr.textContent = "Bound - Receptor Activated!";
    if (effect) effect.innerHTML = '<strong style="color:var(--teal);">Receptor Activated</strong><br><span style="font-size:11px;">Signal Cascade Begins. Cells Respond Downstream.</span>';
  }, 500);
}

function resetBinding() {
  boundState = false;
  const p = document.getElementById("lkPeptide");
  const r = document.getElementById("lkReceptor");
  const effect = document.getElementById("lkEffect");
  const instr = document.getElementById("lkInstr");
  if (p) { p.style.transform = ""; p.style.transition = ""; }
  if (r) { r.style.borderColor = ""; r.style.background = ""; }
  if (instr) instr.textContent = "Tap The Peptide To Try Binding";
  if (effect) effect.textContent = "Drag The Peptide Onto The Receptor To See What Happens";
}

// =====================================================
// HALF-LIFE EXPLORER
// =====================================================
const hlMax = 192;

function showHL(name, hours, color) {
  const res = document.getElementById("hlResult");
  if (!res) return;
  res.style.display = "block";
  const nameEl = document.getElementById("hlName");
  const timeEl = document.getElementById("hlTime");
  const bar = document.getElementById("hlBar");
  const noteEl = document.getElementById("hlNote");
  if (nameEl) nameEl.textContent = name;
  const label = hours < 1 ? (hours * 60).toFixed(0) + " Minutes" : hours + " Hours";
  if (timeEl) timeEl.textContent = "Half-Life: " + label;
  if (bar) {
    bar.style.background = color;
    bar.style.width = "0%";
    setTimeout(() => { bar.style.width = Math.min(100, (hours / hlMax) * 100) + "%"; }, 50);
  }
  const notes = {
    "BPC-157": "Does Not Last Long In The Body, So Studies Use Small Amounts More Than Once A Day.",
    "TB-500": "Lasts A Long Time, So Studies Usually Use It About Twice A Week.",
    "Sermorelin": "Very Quick. It Is Usually Used Right Before Sleep, To Match The Body's Natural Nighttime Growth Signal.",
    "Ipamorelin": "Lasts A Medium Amount Of Time. Studies Usually Use It Once A Night.",
    "CJC-1295 DAC": "Lasts A Very Long Time, So Just Once Or Twice A Week Keeps It Working Steadily."
  };
  if (noteEl) noteEl.textContent = notes[name] || "";
}

// =====================================================
// STORAGE TABS
// =====================================================
function switchTab(id) {
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.remove("active");
    t.setAttribute("aria-selected", "false");
  });
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  const btn = document.getElementById("tab-btn-" + id);
  const panel = document.getElementById("tab-" + id);
  if (btn) { btn.classList.add("active"); btn.setAttribute("aria-selected", "true"); }
  if (panel) panel.classList.add("active");
}

// =====================================================
// RECONSTITUTION CALCULATOR
// =====================================================
function calcRecon() {
  const mg = parseFloat(document.getElementById("calcVial").value) || 5;
  const conc = parseFloat(document.getElementById("calcConc").value) || 1000;
  const mL = (mg * 1000) / conc;
  const waterEl = document.getElementById("calcWater");
  const summaryEl = document.getElementById("calcSummary");
  if (waterEl) waterEl.textContent = mL.toFixed(2) + " mL";
  if (summaryEl) summaryEl.textContent = mg + " mg Vial + " + mL.toFixed(2) + " mL BAC Water = " + conc + " mcg/mL Solution";
  const doses = [50, 100, 150, 200, 250, 300, 500];
  const tbody = document.getElementById("calcTableBody");
  if (tbody) {
    tbody.innerHTML = "";
    doses.forEach(d => {
      const vol = d / conc;
      const units = vol * 100;
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border)";
      tr.innerHTML = `<td style="padding:8px 16px;">${d} mcg</td><td style="padding:8px 16px;text-align:right;">${vol.toFixed(3)} mL</td><td style="padding:8px 16px;text-align:right;">${units.toFixed(1)} units</td>`;
      tbody.appendChild(tr);
    });
    const tableEl = document.getElementById("calcDoseTable");
    if (tableEl) tableEl.style.display = "block";
  }
}

function setPreset(mg) {
  const el = document.getElementById("calcVial");
  if (el) el.value = mg;
  calcRecon();
}

function setConc(c) {
  const el = document.getElementById("calcConc");
  if (el) el.value = c;
  calcRecon();
}

// =====================================================
// DOSING REFERENCE TABLE
// =====================================================
let doseFiltered = [...doseData];

function renderDoseTable() {
  const tbody = document.getElementById("doseTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  doseFiltered.forEach(row => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid var(--border)";
    row.forEach((cell, i) => {
      const td = document.createElement("td");
      td.style.padding = "10px 16px";
      if (i === 0) td.style.fontWeight = "600";
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function filterDose() {
  const q = (document.getElementById("doseSearch").value || "").toLowerCase();
  doseFiltered = doseData.filter(r => r[0].toLowerCase().includes(q));
  if (sortCol >= 0) doseFiltered.sort((a, b) => a[sortCol].localeCompare(b[sortCol]) * sortDir);
  renderDoseTable();
}

function sortDose(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  document.querySelectorAll(".sort-th").forEach((th, i) => {
    th.setAttribute("aria-sort", i === col ? (sortDir === 1 ? "ascending" : "descending") : "none");
    const arrow = th.querySelector(".sort-arrow");
    if (arrow) arrow.innerHTML = i === col ? (sortDir === 1 ? "&#8593;" : "&#8595;") : "&#8597;";
  });
  doseFiltered.sort((a, b) => a[col].localeCompare(b[col]) * sortDir);
  renderDoseTable();
}

// =====================================================
// GLOSSARY
// =====================================================
function openGloss() { openGlossary(); }

function openGlossary() {
  const modal = document.getElementById("glossaryModal");
  if (!modal) return;
  modal.style.display = "block";
  document.body.style.overflow = "hidden";
  renderGlossary(glossaryTerms);
  setTimeout(() => {
    const si = document.getElementById("glossarySearch");
    if (si) si.focus();
  }, 50);
  modal.addEventListener("keydown", trapFocus);
}

function closeGlossary() {
  const modal = document.getElementById("glossaryModal");
  if (!modal) return;
  modal.style.display = "none";
  document.body.style.overflow = "";
  modal.removeEventListener("keydown", trapFocus);
}

function trapFocus(e) {
  if (e.key !== "Tab") return;
  const modal = document.getElementById("glossaryModal");
  const focusable = modal.querySelectorAll('button:not([aria-hidden="true"]), input');
  if (focusable.length < 2) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function filterGlossary() {
  const q = (document.getElementById("glossarySearch").value || "").toLowerCase();
  renderGlossary(glossaryTerms.filter(t => t.term.toLowerCase().includes(q) || t.def.toLowerCase().includes(q)));
}

function renderGlossary(terms) {
  const list = document.getElementById("glossaryList");
  if (!list) return;
  if (terms.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">No Terms Found</p>';
    return;
  }
  list.innerHTML = "";
  terms.forEach(t => {
    const div = document.createElement("div");
    div.style.cssText = "padding:12px;background:var(--surface2);border-radius:10px;margin-bottom:8px;";
    div.innerHTML = `<strong style="font-size:14px;color:var(--teal);">${t.term}</strong><p style="font-size:13px;color:var(--silver);margin:6px 0 0;">${t.def}</p>`;
    list.appendChild(div);
  });
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeGlossary();
});

// =====================================================
// PRINT CERTIFICATE
// =====================================================
function printCert() { window.print(); }

// =====================================================
// COPY SHARE TEXT
// =====================================================
function copyShare() {
  const el = document.getElementById("shareText");
  const btn = document.getElementById("copyBtn");
  if (!el || !btn) return;
  const text = el.textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
    setTimeout(() => {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy To Clipboard';
    }, 2500);
  }).catch(() => { btn.textContent = "Use Long-Press To Copy"; });
}

// =====================================================
// BOOT
// =====================================================
document.addEventListener("DOMContentLoaded", function() {
  goTo(0);
  calcRecon();
  renderDoseTable();
  loadProgress();
});


/* =====================================================================
   PEPTIDE 101 - ENHANCEMENT ENGINE v3
   Appended to app.js. Adds: real completion tracking + unlock, richer
   quizzes + per-module checks + final assessment, 4 new content modules,
   personalized certificate + Research Library links, CSS/SVG animations,
   inline glossary tooltips, in-app references (Omega Protocol via
   /api/proxy), key-takeaways, why-this-matters hooks, accessibility.
   ===================================================================== */
(function(){
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var LS = 'p101_progress_v3';
  function qs(s,r){return (r||document).querySelector(s);}
  function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function el(html){var d=document.createElement('div');d.innerHTML=html.trim();return d.firstChild;}
  function ic(d,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||2)+'">'+d+'</svg>';}
  var __origShowHL=window.showHL, __origCalc=window.calcRecon;

  /* ---------- ORDER + REGISTRY ---------- */
  var ORDER = ['s0','s1','s2','s3','s4','s5','s6','s7','s8','s9','s11','s12','s13','s14','s15','s10'];
  var CONTENT = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s11','s12','s13','s14'];
  var REG = {
    s1:{n:1,t:'What Is A Peptide?',time:'4 Min'}, s2:{n:2,t:'Building A Peptide',time:'5 Min'},
    s3:{n:3,t:'The Lock And Key',time:'4 Min'}, s4:{n:4,t:'What Peptides Are Studied For',time:'5 Min'},
    s5:{n:5,t:'Handling And Storage',time:'6 Min'}, s6:{n:6,t:'Peptide Families',time:'8 Min'},
    s7:{n:7,t:'Stacking And Protocols',time:'4 Min'}, s8:{n:8,t:'Reconstitution Calculator',time:'4 Min'},
    s9:{n:9,t:'Dosing Reference',time:'3 Min'}, s11:{n:10,t:'What Peptides Are NOT',time:'4 Min'},
    s12:{n:11,t:'Why Peptides Are Injected',time:'3 Min'}, s13:{n:12,t:'Safety, Purity And Sourcing',time:'5 Min'},
    s14:{n:13,t:'Legality And Research Use',time:'3 Min'}
  };
  var ICN = {
    s11:ic('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
    s12:ic('<path d="M18 2l4 4M16.5 7.5l-2-2M3.5 20.5l6.5-6.5M13 5l6 6-8.5 8.5H7v-3.5z"/>'),
    s13:ic('<path d="M12 3l8 3v6c0 5-3.5 7.6-8 9-4.5-1.4-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
    s14:ic('<path d="M12 3v18M6 21h12M4 8h16M7 8l-2.5 5.5h5zM17 8l-2.5 5.5h5z"/>'),
    cert:ic('<circle cx="12" cy="9" r="6"/><path d="M9 14.5 8 22l4-2.5L16 22l-1-7.5"/>')
  };

  /* ---------- LIBRARY LINK HELPER ---------- */
  function lib(slug,label){return '<a class="lib-link" href="/research/compounds/'+slug+'">'+ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>')+label+'</a>';}
  function libRow(arr){return '<div class="lib-links">'+arr.map(function(x){return lib(x[0],x[1]);}).join('')+'</div>';}

  /* ---------- PER-MODULE META ---------- */
  var META = {
    s1:{why:'Everything Else In This Course Builds On This One Idea, So It Is Worth A Minute.',
      take:['A Peptide Is A Short Chain Of Amino Acids (2 To 50).','Past 50 Links It Becomes A Protein.','Your Body Already Makes And Uses Peptides Every Day.'],
      refs:[['What Are Peptides? (NIH)','https://pubmed.ncbi.nlm.nih.gov/?term=therapeutic+peptides+review','PubMed']]},
    s2:{why:'Knowing How The Links Form Explains Why Peptides Are Fragile And Why Order Matters.',
      take:['Amino Acids Join With Strong Peptide Bonds.','A Tiny Drop Of Water Leaves When A Bond Forms.','Every Link In The Right Order Is Needed To Work.'],
      refs:[['Peptide Bond Chemistry','https://pubmed.ncbi.nlm.nih.gov/?term=peptide+bond+formation','PubMed']]},
    s3:{why:'This Is The Core Of How Every Peptide Does Its Job In The Body.',
      take:['Peptides Work Like Keys Fitting Specific Locks (Receptors).','Shape Is Everything, Not Size Or Color.','Binding Triggers A Signal Inside The Cell.'],
      refs:[['Receptor Binding Basics','https://pubmed.ncbi.nlm.nih.gov/?term=peptide+receptor+binding+signaling','PubMed']]},
    s4:{why:'This Is Where The Science Gets Real - The Areas Researchers Actually Study.',
      take:['Peptides Are Studied For Healing, Growth, Metabolism, And More.','Each Area Has Specific Peptides Being Investigated.','None Are Approved Drugs - This Is Research.'],
      lib:[['bpc-157','BPC-157'],['tb-500','TB-500'],['ipamorelin','Ipamorelin']],
      refs:[['Peptide Research Areas','https://pubmed.ncbi.nlm.nih.gov/?term=research+peptides+preclinical','PubMed']]},
    s5:{why:'A Mishandled Peptide Is A Wasted One - Storage Protects Your Research.',
      take:['Heat, Light, Moisture, And Freeze-Thaw All Degrade Peptides.','Dry Powder Lasts Months; Liquid Lasts Weeks.','BAC Water Beats Plain Water For Shelf Life.'],
      refs:[['Peptide Stability And Storage','https://pubmed.ncbi.nlm.nih.gov/?term=peptide+stability+storage+degradation','PubMed']]},
    s6:{why:'Grouping Peptides By Job Makes The Whole Catalog Easy To Navigate.',
      take:['Peptides Cluster Into Families By The System They Target.','Each Family Shares A Common Mechanism.','Knowing The Family Predicts What A Peptide Does.'],
      lib:[['bpc-157','Recovery'],['cjc-1295','Growth Axis'],['ghk-cu','Skin']],
      refs:[['Peptide Classification','https://pubmed.ncbi.nlm.nih.gov/?term=peptide+classes+mechanism','PubMed']]},
    s7:{why:'Stacking Is Where Researchers Combine Mechanisms - And Where Mistakes Happen.',
      take:['Stacking Combines Peptides That Hit Different Pathways.','Synergy Comes From Complementary Mechanisms.','All Of This Is Research Framework, Not Human Advice.'],
      refs:[['Combination Peptide Research','https://pubmed.ncbi.nlm.nih.gov/?term=combination+peptide+therapy','PubMed']]},
    s8:{why:'Get The Math Wrong And Every Number After It Is Wrong - So Master This.',
      take:['Reconstitution Turns Dry Powder Into A Measured Liquid.','Concentration Depends On How Much Water You Add.','The Formula: Vial mg x 1000 / Concentration = mL.'],
      refs:[['Reconstitution Principles','https://pubmed.ncbi.nlm.nih.gov/?term=lyophilized+peptide+reconstitution','PubMed']]},
    s9:{why:'A Quick Reference You Will Come Back To Again And Again.',
      take:['Different Peptides Use Different Amounts And Schedules.','Half-Life Drives How Often Something Is Used.','These Are Study Figures, Not Instructions For People.'],
      refs:[['Preclinical Dosing Data','https://pubmed.ncbi.nlm.nih.gov/?term=peptide+dose+pharmacokinetics','PubMed']]},
    s11:{why:'Clearing Up What Peptides Are NOT Prevents The Most Common (And Risky) Mistakes.',
      take:['Peptides Are Not Steroids Or Hormones-In-A-Bottle.','They Are Not FDA-Approved Medicines.','They Are Signals, Not Magic - Results Vary And Are Researched.'],
      refs:[['Peptides Vs Other Compounds','https://pubmed.ncbi.nlm.nih.gov/?term=peptides+versus+steroids+anabolic','PubMed']]},
    s12:{why:'This One Fact Explains Why Almost Every Research Peptide Is Injected.',
      take:['Your Stomach Digests Peptides Like It Digests Food.','Injection Bypasses The Gut So The Peptide Survives.','Short Survival In The Body Is Also Why They Act Briefly.'],
      refs:[['Oral Peptide Bioavailability','https://pubmed.ncbi.nlm.nih.gov/?term=oral+peptide+bioavailability+degradation','PubMed']]},
    s13:{why:'The Single Most Important Topic For Real Research: Is What You Have Pure And Safe?',
      take:['Research-Grade Means Tested For Identity And Purity.','A COA Shows Mass-Spec Identity And HPLC Purity Percent.','No COA, Unusual Color, Or Too-Cheap Price Are Red Flags.'],
      refs:[['Understanding A Certificate Of Analysis','https://pubmed.ncbi.nlm.nih.gov/?term=peptide+purity+HPLC+mass+spectrometry','PubMed']]},
    s14:{why:'Knowing The Rules Keeps Your Research Legitimate And Protects You.',
      take:['Research Peptides Are For Laboratory Use Only.','They Are Not Approved For Human Use.','Always Follow Local Laws And Institutional Rules.'],
      refs:[['Research-Use-Only Status','https://pubmed.ncbi.nlm.nih.gov/?term=research+use+only+regulatory+peptide','PubMed']]}
  };

  /* ---------- QUIZ EXPLANATIONS (inline q2/q3/q4 + injected checks) ---------- */
  var QEX = {
    q2:{ex:'A Chain Of 2 To 50 Amino Acids Is A Peptide. It Only Becomes A Protein Past About 50 Links.'},
    q3:{ex:'Binding Depends On Shape. The Peptide Must Fit Its Receptor Like A Key Fits A Lock - Size, Charge, And Color Do Not Decide It.'},
    q4:{ex:'Ipamorelin Is A Growth-Hormone Secretagogue. BPC-157 And TB-500 Are Studied For Tissue Repair Instead.'},
    cq1:{ex:'Peptides Are Short Chains Of Amino Acids. DNA, Sugars, And Fats Are Different Kinds Of Molecules.'},
    cq5:{ex:'Once Mixed With Water A Peptide Is Fragile And Belongs In The Fridge - Not Left Warm On The Bench.'},
    cq6:{ex:'The Growth Hormone Axis Family Nudges The Body To Release Its Own Growth Hormone.'},
    cq7:{ex:'Stacking Works When Each Peptide Hits A Different Pathway, So Their Effects Add Up.'},
    cq8:{ex:'More Water Spreads The Same Powder Thinner, So The Concentration (Strength) Goes Down.'},
    cq9:{ex:'A Short Half-Life Clears Fast, So Studies Dose It More Often To Keep Levels Up.'},
    cq11:{ex:'Peptides Are Signaling Molecules, Not Anabolic Steroids And Not Approved Medicines.'},
    cq12:{ex:'The Stomach Breaks Peptide Bonds During Digestion, So Most Peptides Are Injected Instead Of Swallowed.'},
    cq13:{ex:'A Certificate Of Analysis Confirms Identity (Mass Spec) And Purity (HPLC Percent) For That Exact Batch.'},
    cq14:{ex:'Research Use Only Means Laboratory Research - Not Approved For Human Use.'}
  };
  /* injected checks for modules without an inline quiz */
  var CHECKS = {
    s1:{id:'cq1',q:'A Peptide Is A Short Chain Of What?',o:[['Amino Acids',1],['Sugar Molecules',0],['Strands Of DNA',0]]},
    s5:{id:'cq5',q:'After You Mix A Peptide With Water, Where Should It Go?',o:[['Left Out At Room Temperature',0],['Into The Fridge',1],['Into Direct Sunlight',0]]},
    s6:{id:'cq6',q:'Which Family Nudges The Body To Release Its Own Growth Hormone?',o:[['Melanocortin System',0],['Growth Hormone Axis',1],['Cognitive Peptides',0]]},
    s7:{id:'cq7',q:'Stacking Works Best When The Two Peptides...',o:[['Do The Exact Same Thing',0],['Hit Different Pathways',1],['Are The Same Color',0]]},
    s8:{id:'cq8',q:'If You Add MORE Water To The Same Powder, The Strength...',o:[['Goes Up',0],['Goes Down',1],['Stays The Same',0]]},
    s9:{id:'cq9',q:'A Short Half-Life Usually Means You Use It...',o:[['Less Often',0],['More Often',1],['Only Once Ever',0]]},
    s11:{id:'cq11',q:'Which Statement Is TRUE About Peptides?',o:[['They Are Anabolic Steroids',0],['They Are Approved Medicines',0],['They Are Signaling Molecules',1]]},
    s12:{id:'cq12',q:'Why Are Most Peptides Injected Instead Of Swallowed?',o:[['They Taste Bad',0],['The Stomach Digests Them',1],['They Are Too Big To Swallow',0]]},
    s13:{id:'cq13',q:'A Certificate Of Analysis (COA) Mainly Proves...',o:[['The Price Is Fair',0],['Identity And Purity Of The Batch',1],['The Color Looks Nice',0]]},
    s14:{id:'cq14',q:'"Research Use Only" Means The Peptide Is...',o:[['Approved For Human Use',0],['For Laboratory Research Only',1],['A Prescription Drug',0]]}
  };

  /* ---------- FINAL ASSESSMENT ---------- */
  var EXAM = [
    {q:'How Many Amino Acids Make Something A Peptide (Not A Protein)?',o:['2 To 50','51 To 100','Exactly 1','Over 1000'],a:0,ex:'2 To 50 Links Is A Peptide; Past About 50 It Becomes A Protein.'},
    {q:'A Peptide Binds To Its Receptor Mainly Because Of Its...',o:['Color','Shape','Price','Smell'],a:1,ex:'Shape Decides Binding - The Key Must Fit The Lock.'},
    {q:'When Two Amino Acids Join, What Small Molecule Leaves?',o:['Oxygen','Salt','Water','Sugar'],a:2,ex:'A Tiny Drop Of Water Is Released When A Peptide Bond Forms.'},
    {q:'Most Research Peptides Are Injected Rather Than Swallowed Because...',o:['They Taste Bad','The Stomach Digests Them','They Are Illegal To Eat','They Are Too Cold'],a:1,ex:'Digestion Breaks Peptide Bonds, So Swallowing Would Destroy Them.'},
    {q:'A Liquid (Reconstituted) Peptide Should Be Stored...',o:['On The Bench','In The Fridge','In Sunlight','In A Hot Car'],a:1,ex:'Once Mixed With Water, Peptides Are Fragile And Belong In The Fridge.'},
    {q:'Add MORE Water To The Same Powder And The Concentration...',o:['Goes Up','Goes Down','Stays Equal','Disappears'],a:1,ex:'The Same Powder Spread Through More Water Is Weaker.'},
    {q:'A Certificate Of Analysis (COA) Confirms...',o:['Identity And Purity','The Shipping Speed','The Brand Logo','The Vial Size Only'],a:0,ex:'A COA Shows Mass-Spec Identity And HPLC Purity For That Batch.'},
    {q:'Which Is TRUE About Research Peptides?',o:['They Are Steroids','They Are FDA-Approved Drugs','They Are For Research Use Only','They Cure Everything'],a:2,ex:'They Are Research-Use-Only Signaling Molecules, Not Approved Drugs.'},
    {q:'A SHORT Half-Life Means A Peptide Is Usually Used...',o:['Once A Year','More Often','Never','Only Frozen'],a:1,ex:'Short Half-Life Clears Fast, So It Is Dosed More Often In Studies.'},
    {q:'Stacking Two Peptides Works Best When They...',o:['Do The Same Job','Hit Different Pathways','Are The Same Color','Are Both Expired'],a:1,ex:'Different Pathways Let Their Effects Add Up (Synergy).'}
  ];

  /* ---------- NEW MODULE BODIES ---------- */
  var NEWHTML = {
    s11:'<div class="badge badge-teal">Module 10 - Clearing The Confusion</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">What Peptides Are NOT</h2>'+
      '<p style="margin-bottom:20px;">Before Going Further, Let Us Clear Up The Three Biggest Myths. Knowing What Peptides Are NOT Is As Important As Knowing What They Are.</p>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:12px;">Peptides Vs. Things People Confuse Them With</h3>'+
      '<div style="display:flex;flex-direction:column;gap:10px;">'+
      '<div style="padding:11px;background:var(--surface2);border-radius:10px;border-left:3px solid var(--teal);"><strong style="font-size:13px;">Not Steroids</strong><p style="font-size:12px;margin-top:3px;">Steroids Are Powerful Hormones That Force A Big Change. Peptides Are Gentle Signals That Ask The Body To Do Something It Already Knows How To Do.</p></div>'+
      '<div style="padding:11px;background:var(--surface2);border-radius:10px;border-left:3px solid var(--blue-l);"><strong style="font-size:13px;">Not Approved Medicines</strong><p style="font-size:12px;margin-top:3px;">A Medicine Has Passed Years Of Trials And Is Approved To Treat People. Research Peptides Have Not - They Are Studied In Labs.</p></div>'+
      '<div style="padding:11px;background:var(--surface2);border-radius:10px;border-left:3px solid var(--silver);"><strong style="font-size:13px;">Not Magic</strong><p style="font-size:12px;margin-top:3px;">They Do Not Work Instantly Or For Everyone. They Are One Small Signal Among Thousands, And Their Effects Are Still Being Researched.</p></div>'+
      '</div></div>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:10px;">A Simple Way To Remember It</h3>'+
      '<p style="font-size:14px;">A Peptide Is Like A Short Text Message To Your Cells. A Steroid Is Like Someone Shouting Through A Megaphone. A Medicine Is A Message That Has Been Tested And Approved. A Peptide In Research Is A Message Scientists Are Still Reading.</p></div>'+
      '<div class="nav-ctrl"></div>',
    s12:'<div class="badge badge-teal">Module 11 - A Key Fact</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">Why Peptides Are Injected, Not Swallowed</h2>'+
      '<p style="margin-bottom:20px;">Ever Wonder Why You Do Not Just Take A Peptide As A Pill? The Answer Is Sitting In Your Stomach Right Now.</p>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:10px;">Your Stomach Is A Shredder</h3>'+
      '<p style="font-size:14px;">Your Stomach Breaks Food Apart By Snapping The Exact Same Bonds That Hold A Peptide Together. So If You Swallowed A Peptide, Your Body Would Treat It Like Lunch And Digest It Before It Could Do Anything.</p>'+
      '<div style="display:flex;gap:14px;justify-content:center;margin-top:16px;flex-wrap:wrap;">'+
      '<div style="text-align:center;"><div style="width:64px;height:64px;border-radius:14px;display:grid;place-items:center;margin:0 auto;background:rgba(229,62,62,.08);border:1px solid rgba(229,62,62,.3);"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/></svg></div><div style="font-size:12px;margin-top:6px;color:var(--muted);">Swallowed: Destroyed</div></div>'+
      '<div style="text-align:center;"><div style="width:64px;height:64px;border-radius:14px;display:grid;place-items:center;margin:0 auto;background:rgba(0,196,188,.08);border:1px solid rgba(0,196,188,.3);"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></div><div style="font-size:12px;margin-top:6px;color:var(--muted);">Injected: Survives</div></div>'+
      '</div></div>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:10px;">Injection Skips The Gut</h3>'+
      '<p style="font-size:14px;">A Small Injection Just Under The Skin Puts The Peptide Straight Into The Body, Past The Stomach. That Is Why Almost Every Research Peptide Is Used As An Injection Instead Of A Pill.</p></div>'+
      '<div class="callout"><strong>Connects Back:</strong> This Is The Same Reason Peptides Do Not Last Long - The Body Is Very Good At Breaking Them Down, Inside Or Out.</div>'+
      '<div class="nav-ctrl"></div>',
    s13:'<div class="badge badge-teal">Module 12 - The Most Important Module</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">Safety, Purity And Sourcing</h2>'+
      '<p style="margin-bottom:20px;">For Real Research, One Question Matters More Than Any Other: Is What You Have Actually What The Label Says, And Is It Clean? Here Is How You Know.</p>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:10px;">Why Research-Grade Matters</h3>'+
      '<p style="font-size:14px;">Two Vials Can Look Identical And Be Completely Different Inside. Research-Grade Means The Batch Was Tested - You Know What Is In It, How Pure It Is, And That It Is Free Of Contamination. Untested Material Is A Guess.</p></div>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:12px;">How To Read A COA (Certificate Of Analysis)</h3>'+
      '<p style="font-size:13px;margin-bottom:12px;">A COA Is The Lab Report For A Specific Batch. Four Things To Look For:</p>'+
      '<div style="display:flex;flex-direction:column;gap:9px;">'+
      '<div style="display:flex;gap:11px;align-items:flex-start;padding:10px;background:var(--surface2);border-radius:10px;"><div style="min-width:26px;height:26px;border-radius:7px;display:grid;place-items:center;background:rgba(0,196,188,.12);flex-shrink:0;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></div><div><strong style="font-size:13px;">Identity (Mass Spec)</strong><p style="font-size:12px;margin-top:2px;">Confirms The Molecule Is Actually The Peptide On The Label, By Its Exact Weight.</p></div></div>'+
      '<div style="display:flex;gap:11px;align-items:flex-start;padding:10px;background:var(--surface2);border-radius:10px;"><div style="min-width:26px;height:26px;border-radius:7px;display:grid;place-items:center;background:rgba(59,130,246,.12);flex-shrink:0;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--blue-l)" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></div><div><strong style="font-size:13px;">Purity (HPLC Percent)</strong><p style="font-size:12px;margin-top:2px;">Shows How Much Is The Real Peptide Vs. Leftovers. Look For A High Percent (Often 98 Or Higher).</p></div></div>'+
      '<div style="display:flex;gap:11px;align-items:flex-start;padding:10px;background:var(--surface2);border-radius:10px;"><div style="min-width:26px;height:26px;border-radius:7px;display:grid;place-items:center;background:rgba(138,155,176,.12);flex-shrink:0;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--silver)" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 7.6-8 9-4.5-1.4-8-4-8-9V6z"/></svg></div><div><strong style="font-size:13px;">Sterility And Endotoxin</strong><p style="font-size:12px;margin-top:2px;">Confirms It Is Free Of Bacteria And Their Byproducts.</p></div></div>'+
      '<div style="display:flex;gap:11px;align-items:flex-start;padding:10px;background:var(--surface2);border-radius:10px;"><div style="min-width:26px;height:26px;border-radius:7px;display:grid;place-items:center;background:rgba(0,196,188,.12);flex-shrink:0;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg></div><div><strong style="font-size:13px;">Batch Number And Date</strong><p style="font-size:12px;margin-top:2px;">The COA Should Match The Exact Batch You Received - Not A Generic One.</p></div></div>'+
      '</div></div>'+
      '<div class="callout callout-red"><strong style="color:var(--red);">Red Flags:</strong> No COA Available, A Generic COA That Does Not Match Your Batch, Cloudy Or Off-Color Powder, Missing Batch Numbers, Or A Price That Seems Too Good To Be True.</div>'+
      '<div class="nav-ctrl"></div>',
    s14:'<div class="badge badge-teal">Module 13 - Know The Rules</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">Legality And Research Use</h2>'+
      '<p style="margin-bottom:20px;">This Part Is Short And Simple, But It Matters. Here Is The Honest, Clear Version.</p>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:10px;">The Simple Version</h3>'+
      '<p style="font-size:14px;">Research Peptides Are Sold For Laboratory Research Only. They Are Not Approved For Human Use, They Are Not Medicines, And They Are Not Prescribed. That Is Not A Loophole - It Is What They Are.</p></div>'+
      '<div class="card"><h3 style="font-size:15px;margin-bottom:10px;">What "Research Use Only" Really Means</h3>'+
      '<p style="font-size:14px;">It Means The Material Is Intended For Studying In A Lab Setting - Measuring, Testing, And Learning. It Has Not Gone Through The Approval Process Required Before Anything Can Be Used In Or On People.</p></div>'+
      '<div class="card" style="border-left:0;"><h3 style="font-size:15px;margin-bottom:10px;">A Sign Of Standards, Not A Warning</h3>'+
      '<p style="font-size:14px;">The Research-Use Framing Is Not Meant To Scare You. It Is A Sign That The Field Takes Rigor Seriously: Clear Labeling, Honest Limits, And Respect For The Rules. Always Follow Your Local Laws And Any Institutional Guidelines.</p></div>'+
      '<div class="nav-ctrl"></div>'
  };

  /* ---------- BODY MAP DATA (Module 6) ---------- */
  var BODY = [
    {id:'brain',label:'Brain',fam:'Cognitive And Nootropic',desc:'Peptides Studied For Focus, Memory, And Feeling Calm Act On Brain Signaling.',chips:[['selank','Selank'],['semax','Semax']]},
    {id:'gh',label:'Growth Axis',fam:'Growth Hormone Axis',desc:'These Nudge The Pituitary To Release Its Own Growth Hormone.',chips:[['sermorelin','Sermorelin'],['cjc-1295','CJC-1295'],['ipamorelin','Ipamorelin']]},
    {id:'skin',label:'Skin',fam:'Skin, Collagen And Melanocortin',desc:'Studied For Collagen, Skin Health, And Pigment Signaling.',chips:[['ghk-cu','GHK-Cu'],['melanotan-ii','Melanotan II']]},
    {id:'muscle',label:'Muscle And Tissue',fam:'Tissue And Recovery',desc:'Studied For Repair Of Muscle, Tendon, And Connective Tissue.',chips:[['bpc-157','BPC-157'],['tb-500','TB-500']]},
    {id:'fat',label:'Metabolism',fam:'Metabolic And Fat Regulation',desc:'Studied For Using Fat For Energy Without A Full Growth Signal.',chips:[['aod-9604','AOD-9604']]}
  ];

  /* ===================================================================
     STATE + PROGRESS
     =================================================================== */
  var state = {done:{}, exam:{passed:false,best:0}, name:''};
  try{var raw=localStorage.getItem(LS); if(raw) state=Object.assign(state,JSON.parse(raw));}catch(e){}
  function save(){try{localStorage.setItem(LS,JSON.stringify(state));}catch(e){}}
  var CUR='s0';
  var ANSWERED={}, SCORE=0;

  function doneCount(){return CONTENT.filter(function(id){return state.done[id];}).length;}
  function isUnlocked(id){ // sequential unlock: first incomplete (or any completed) is open
    var i=CONTENT.indexOf(id); if(i<=0) return true;
    if(state.done[id]) return true;
    return !!state.done[CONTENT[i-1]];
  }
  function markComplete(id){ if(REG[id] && !state.done[id]){ state.done[id]=true; save(); toast(REG[id].t+' Complete'); } updateProgressUI(); }

  function updateProgressUI(){
    var c=doneCount(), pct=Math.round(c/CONTENT.length*100);
    var pf=qs('#progFill'), pl=qs('#progLabel');
    if(pf) pf.style.width=pct+'%'; if(pl) pl.textContent=pct+'%';
    var mf=qs('#s0 .mini-fill'); if(mf) mf.style.width=pct+'%';
    var head=qs('#s0 .roadmap-head span'); if(head) head.textContent=c+' Of '+CONTENT.length+' Modules Complete';
    qsa('#s0 .roadmap-card').forEach(function(card){
      var id=card.dataset.mod; if(!id) return;
      card.classList.remove('is-complete','is-locked','is-current');
      var st=card.querySelector('.rm-state'); if(!st) return;
      if(id==='s15'){ st.innerHTML=ICN.cert.replace('<svg','<svg width="16" height="16"'); st.className='rm-state '+(state.exam.passed?'done':'open'); return; }
      if(state.done[id]){ card.classList.add('is-complete'); st.className='rm-state done'; st.innerHTML=ic('<path d="M20 6 9 17l-5-5"/>').replace('<svg','<svg width="16" height="16"'); }
      else if(isUnlocked(id)){ st.className='rm-state open'; st.innerHTML=ic('<circle cx="12" cy="12" r="9"/>').replace('<svg','<svg width="14" height="14"'); }
      else { card.classList.add('is-locked'); st.className='rm-state'; st.innerHTML=ic('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>').replace('<svg','<svg width="15" height="15"'); }
      if(id===CUR) card.classList.add('is-current');
    });
    qsa('.js-checkscore').forEach(function(e){e.textContent=SCORE+' / '+CONTENT.length;});
  }

  /* ===================================================================
     TOAST
     =================================================================== */
  var toastEl;
  function toast(msg){
    if(!toastEl){ toastEl=el('<div class="p101-toast">'+ic('<path d="M20 6 9 17l-5-5"/>')+'<span></span></div>'); document.body.appendChild(toastEl); }
    toastEl.querySelector('span').textContent=msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t); toastEl._t=setTimeout(function(){toastEl.classList.remove('show');},1800);
  }

  /* ===================================================================
     NAVIGATION (order-aware) - overrides goTo
     =================================================================== */
  function setCertDate(){var d=qs('#certDate'); if(d) d.textContent='Completed: '+new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}
  function showScreen(id){
    if(!document.getElementById(id)) id='s0';
    qsa('.screen').forEach(function(s){s.classList.remove('active');});
    var elx=document.getElementById(id); elx.classList.add('active');
    CUR=id;
    try{curScreen=parseInt(id.replace('s',''))||0;}catch(e){}
    window.scrollTo({top:0,behavior:RM?'auto':'smooth'});
    if(id==='s9' && typeof renderDoseTable==='function') renderDoseTable();
    if(id==='s10'){ setCertDate(); refreshCertGate(); }
    if(id==='s15') resetExamView();
    updateProgressUI(); save();
  }
  function goId(id){ showScreen(id); }
  function next(){ var i=ORDER.indexOf(CUR); if(i<0)return; if(REG[CUR]) markComplete(CUR); if(i<ORDER.length-1) showScreen(ORDER[i+1]); }
  function prev(){ var i=ORDER.indexOf(CUR); if(i>0) showScreen(ORDER[i-1]); }
  window.goTo=function(n){ goId(typeof n==='number'?'s'+n:n); };

  function navHTML(id){
    var i=ORDER.indexOf(id), p=i>0?ORDER[i-1]:null, nx=i<ORDER.length-1?ORDER[i+1]:null;
    var back=(id==='s0'||!p)?'<div></div>':'<button class="btn btn-ghost" onclick="P101.prev()">'+ic('<path d="M19 12H5M12 19l-7-7 7-7"/>').replace('<svg','<svg width="16" height="16"')+'Back</button>';
    var lbl='Next', sub='';
    if(nx==='s15'){lbl='Begin Final Quiz';} else if(nx==='s10'){lbl='Finish';} else if(nx&&REG[nx]){lbl='Next';sub='';}
    var nbtn=nx?'<button class="btn btn-primary" onclick="P101.next()">'+lbl+ic('<path d="M5 12h14M12 5l7 7-7 7"/>').replace('<svg','<svg width="16" height="16"')+'</button>':'<div></div>';
    return back+nbtn;
  }
  function standardizeNav(){
    ORDER.forEach(function(id){
      if(id==='s10'||id==='s15'||id==='s1') return;
      var sc=document.getElementById(id); if(!sc) return;
      var nc=sc.querySelector('.nav-ctrl');
      if(!nc){ nc=el('<div class="nav-ctrl"></div>'); sc.appendChild(nc); }
      nc.innerHTML=navHTML(id);
    });
  }

  /* ===================================================================
     QUIZ override (explanations + retry + running score)
     =================================================================== */
  window.quiz=function(qid,btn,correct){
    var opts=btn.closest('.quiz-opts'); if(!opts||opts.classList.contains('locked')) return;
    opts.classList.add('locked');
    if(correct) btn.classList.add('correct');
    else { btn.classList.add('wrong'); opts.querySelectorAll('.quiz-opt').forEach(function(b){var oc=b.getAttribute('onclick')||''; if(oc.indexOf(',true)')>-1) b.classList.add('correct');}); }
    if(!ANSWERED[qid]){ ANSWERED[qid]=true; if(correct) SCORE++; }
    var fb=document.getElementById(qid+'-fb'); var dx=(QEX[qid]||{}).ex||'';
    if(fb){
      fb.classList.add('show');
      fb.innerHTML=(correct?'<strong style="color:var(--green);">Correct.</strong>':'<strong style="color:var(--red);">Not Quite - See Below.</strong>')+
        '<div class="quiz-explain '+(correct?'':'bad')+' show">'+dx+'</div>';
      if(!correct){
        var rb=el('<button class="btn btn-ghost quiz-retry show" style="margin-top:9px;min-height:40px;padding:8px 16px;font-size:13px;">Try Again</button>');
        rb.addEventListener('click',function(){ opts.classList.remove('locked'); opts.querySelectorAll('.quiz-opt').forEach(function(b){b.classList.remove('correct','wrong');}); fb.classList.remove('show'); fb.innerHTML=''; });
        fb.appendChild(rb);
      }
    }
    updateProgressUI();
  };
  function checkHTML(c){
    var opts=c.o.map(function(o){return '<button class="quiz-opt" onclick="quiz(\''+c.id+'\',this,'+(o[1]?'true':'false')+')">'+ic('<circle cx="12" cy="12" r="10"/>').replace('<svg','<svg width="16" height="16"')+o[0]+'</button>';}).join('');
    return '<div class="card check-q"><div class="qh"><strong>Check Your Understanding</strong><span class="score-pill">'+ic('<path d="M20 6 9 17l-5-5"/>').replace('<svg','<svg width="14" height="14"')+'<span class="js-checkscore">0 / '+CONTENT.length+'</span></span></div>'+
      '<p style="font-size:14px;margin:6px 0 4px;">'+c.q+'</p><div class="quiz-opts">'+opts+'</div><div class="quiz-fb" id="'+c.id+'-fb"></div></div>';
  }

  /* ===================================================================
     INJECT META (hooks, checks, takeaways, lib links, refs) per module
     =================================================================== */
  function injectMeta(id){
    if (id === 's1') return; // Do not inject old meta into the new image-based Module 1
    var sc=document.getElementById(id); if(!sc) return; if(sc.getAttribute('data-meta-done')) return; sc.setAttribute('data-meta-done','1'); var m=META[id]||{};
    var nc=sc.querySelector('.nav-ctrl');
    // why-hook after first h2
    if(m.why){ var h2=sc.querySelector('h2'); var hk=el('<div class="why-hook">'+ic('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>')+'<p><strong>Why This Matters:</strong> '+m.why+'</p></div>'); if(h2&&h2.nextSibling) h2.parentNode.insertBefore(hk,h2.nextSibling); else sc.insertBefore(hk,sc.firstChild); }
    var frag=document.createDocumentFragment();
    // check (only if no inline quiz already)
    if(CHECKS[id] && !sc.querySelector('.quiz-opts')){ frag.appendChild(el(checkHTML(CHECKS[id]))); }
    // takeaways
    if(m.take){ frag.appendChild(el('<div class="takeaways"><h4>'+ic('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')+'Key Takeaways</h4><ul>'+m.take.map(function(t){return '<li>'+ic('<path d="M20 6 9 17l-5-5"/>')+'<span>'+t+'</span></li>';}).join('')+'</ul></div>')); }
    // library links
    if(m.lib){ frag.appendChild(el('<div class="card" style="padding:16px 18px;"><div class="refs-h">'+ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>')+'Go Deeper In The Research Library</div>'+libRow(m.lib)+'</div>')); }
    // references
    if(m.refs){ var rl=m.refs.map(function(r){return '<button class="ref-btn" onclick="P101.openRef(\''+encodeURIComponent(r[1])+'\',\''+r[0].replace(/'/g,'')+'\',\''+r[2]+'\')">'+ic('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>')+'<span>'+r[0]+'</span><span class="src">'+r[2]+'</span></button>';}).join('');
      frag.appendChild(el('<div class="card refs" style="padding:16px 18px;"><div class="refs-h">'+ic('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>')+'References And Further Reading</div><div class="ref-list">'+rl+'</div></div>')); }
    if(nc) sc.insertBefore(frag,nc); else sc.appendChild(frag);
  }

  /* ===================================================================
     BUILD NEW MODULES + ASSESSMENT
     =================================================================== */
  function buildNewModules(){
    var app=qs('#app'), anchor=qs('#s10');
    ['s11','s12','s13','s14'].forEach(function(id){
      if(document.getElementById(id)) return;
      var sc=el('<div class="screen" id="'+id+'"></div>'); sc.innerHTML=NEWHTML[id];
      app.insertBefore(sc, anchor);
    });
  }
  function buildAssessment(){
    if(document.getElementById('s15')) return;
    var qhtml=EXAM.map(function(q,i){
      var opts=q.o.map(function(o,oi){return '<button class="quiz-opt" data-q="'+i+'" data-o="'+oi+'" onclick="P101.examPick('+i+','+oi+',this)">'+ic('<circle cx="12" cy="12" r="10"/>').replace('<svg','<svg width="16" height="16"')+o+'</button>';}).join('');
      return '<div class="assess-q" id="aq'+i+'"><div class="qn">Question '+(i+1)+' Of '+EXAM.length+'</div><div class="qt">'+q.q+'</div><div class="quiz-opts">'+opts+'</div></div>';
    }).join('');
    var sc=el('<div class="screen" id="s15"></div>');
    sc.innerHTML='<div class="badge badge-teal">Final Assessment</div>'+
      '<h2 style="font-size:28px;margin-bottom:8px;">Final Knowledge Check</h2>'+
      '<p style="margin-bottom:8px;">Answer All '+EXAM.length+' Questions. Score '+PASS+'% Or Higher To Earn Your Certificate. You Can Retry As Many Times As You Like.</p>'+
      '<div style="margin-bottom:18px;"><span class="score-pill">'+ic('<path d="M9 11l3 3L22 4"/>').replace('<svg','<svg width="14" height="14"')+'Module Checks: <span class="js-checkscore">0 / '+CONTENT.length+'</span></span></div>'+
      '<div class="assess-result" id="examResult"></div>'+
      '<div id="examQs">'+qhtml+'</div>'+
      '<div class="nav-ctrl"><button class="btn btn-ghost" onclick="P101.prev()">'+ic('<path d="M19 12H5M12 19l-7-7 7-7"/>').replace('<svg','<svg width="16" height="16"')+'Back</button><button class="btn btn-primary" id="examSubmit" onclick="P101.examSubmit()">Submit Answers'+ic('<path d="M20 6 9 17l-5-5"/>').replace('<svg','<svg width="16" height="16"')+'</button></div>';
    qs('#app').insertBefore(sc, qs('#s10'));
  }
  var PASS=70, examPicks={};
  function resetExamView(){ examPicks={}; var r=qs('#examResult'); if(r){r.classList.remove('show');r.innerHTML='';} qsa('#examQs .assess-q').forEach(function(q){q.classList.remove('locked');q.querySelectorAll('.quiz-opt').forEach(function(b){b.classList.remove('correct','wrong');});}); var qs2=qs('#examQs'); if(qs2) qs2.style.display='block'; var sb=qs('#examSubmit'); if(sb) sb.style.display='inline-flex'; }
  function examPick(qi,oi,btn){ if(qs('#aq'+qi).classList.contains('locked')) return; examPicks[qi]=oi; var p=btn.closest('.quiz-opts'); p.querySelectorAll('.quiz-opt').forEach(function(b){b.classList.remove('correct');}); btn.style.borderColor='var(--teal)'; p.querySelectorAll('.quiz-opt').forEach(function(b){if(b!==btn)b.style.borderColor='';}); }
  function examSubmit(){
    var correct=0;
    EXAM.forEach(function(q,i){
      var aq=qs('#aq'+i); aq.classList.add('locked');
      var btns=aq.querySelectorAll('.quiz-opt'); var pick=examPicks[i];
      btns.forEach(function(b,oi){ b.style.borderColor=''; if(oi===q.a) b.classList.add('correct'); else if(oi===pick) b.classList.add('wrong'); });
      if(pick===q.a) correct++;
      if(!aq.querySelector('.quiz-explain')){ aq.appendChild(el('<div class="quiz-explain show'+(pick===q.a?'':' bad')+'">'+q.ex+'</div>')); }
    });
    var pct=Math.round(correct/EXAM.length*100), passed=pct>=PASS;
    if(passed){ state.exam.passed=true; } state.exam.best=Math.max(state.exam.best||0,pct); save();
    var col=passed?'var(--green)':'var(--yellow)';
    var circ=2*Math.PI*46, off=circ*(1-pct/100);
    var r=qs('#examResult');
    r.innerHTML='<div class="assess-ring"><svg width="104" height="104" viewBox="0 0 104 104"><circle class="track" cx="52" cy="52" r="46"/><circle class="meter" cx="52" cy="52" r="46" stroke="'+col+'" stroke-dasharray="'+circ+'" stroke-dashoffset="'+circ+'" id="examMeter"/></svg><div class="assess-pct">'+pct+'%</div></div>'+
      '<h3 style="font-size:20px;margin-bottom:6px;color:#fff;">'+(passed?'You Passed.':'Almost There.')+'</h3>'+
      '<p style="font-size:14px;color:var(--silver);max-width:420px;margin:0 auto 14px;">'+(passed?'You Scored '+pct+'% And Earned Your Certificate.':'You Scored '+pct+'%. You Need '+PASS+'% - Review The Answers Below And Try Again.')+'</p>'+
      (passed?'<button class="btn btn-primary" onclick="P101.toCert()">View My Certificate'+ic('<path d="M5 12h14M12 5l7 7-7 7"/>').replace('<svg','<svg width="16" height="16"')+'</button>':'<button class="btn btn-primary" onclick="P101.examRetry()">Try Again'+ic('<path d="M3.5 12a8.5 8.5 0 1 1 2.5 6"/><path d="M3 21v-5h5"/>').replace('<svg','<svg width="16" height="16"')+'</button>');
    r.classList.add('show');
    var sb=qs('#examSubmit'); if(sb) sb.style.display='none';
    setTimeout(function(){var mt=qs('#examMeter'); if(mt) mt.style.strokeDashoffset=off;},80);
    r.scrollIntoView({behavior:RM?'auto':'smooth',block:'center'});
    updateProgressUI();
  }
  function examRetry(){ resetExamView(); qsa('#examQs .quiz-explain').forEach(function(e){e.remove();}); var q=qs('#examQs'); if(q) q.scrollIntoView({behavior:RM?'auto':'smooth'}); }
  function toCert(){ showScreen('s10'); }

  /* ===================================================================
     CERTIFICATE: name field + gate + library CTA
     =================================================================== */
  function refreshCertGate(){
    var cb=qs('#certBlock'); if(!cb) return;
    var gate=qs('#certGate');
    if(!state.exam.passed){
      cb.style.display='none';
      if(!gate){ gate=el('<div class="card" id="certGate" style="text-align:center;"><div style="width:64px;height:64px;border-radius:50%;display:grid;place-items:center;margin:0 auto 12px;background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.3);"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div><h3 style="font-size:18px;margin-bottom:6px;">One Step Left</h3><p style="font-size:14px;color:var(--silver);max-width:380px;margin:0 auto 14px;">Pass The Final Knowledge Check To Unlock Your Certificate.</p><button class="btn btn-primary" onclick="P101.go(\'s15\')">Take The Final Quiz</button></div>');
        cb.parentNode.insertBefore(gate,cb); }
      gate.style.display='block';
    } else { if(gate) gate.style.display='none'; cb.style.display='block'; applyName(); }
  }
  function applyName(){ var on=qs('#certNameOn'); if(on) on.textContent=state.name||'Researcher'; var inp=qs('#certNameInput'); if(inp && !inp.value) inp.value=state.name||''; }
  function enhanceCert(){
    var cb=qs('#certBlock'); if(!cb) return;
    var certifies=Array.prototype.slice.call(cb.querySelectorAll('p')).filter(function(x){return /This Certifies/i.test(x.textContent);})[0];
    if(certifies && !qs('#certNameOn')){
      var block=el('<div style="margin:8px 0 12px;"><div style="font-size:11px;letter-spacing:2px;color:var(--muted);">AWARDED TO</div><div class="cert-name-on" id="certNameOn">Researcher</div></div>');
      certifies.parentNode.insertBefore(block,certifies);
    }
    if(!qs('#certNameInput')){
      var row=el('<div class="cert-name-row"><label for="certNameInput">Your Name (Appears On The Certificate)</label><input type="text" id="certNameInput" class="calc-input cert-name-input" maxlength="40" placeholder="Enter Your Name" autocomplete="name"/></div>');
      cb.insertBefore(row, cb.firstChild);
      row.querySelector('input').addEventListener('input',function(e){ state.name=e.target.value.replace(/[<>]/g,''); save(); applyName(); });
    }
    // continue-learning CTA after the modules-completed list
    if(!qs('#continueLearning')){
      var cl=el('<div class="card" id="continueLearning"><h3 style="font-size:15px;margin-bottom:6px;">Keep Going</h3><p style="font-size:13px;color:var(--silver);margin-bottom:10px;">You Have The Foundations. Explore Real Compounds In The Research Library.</p>'+
        libRow([['bpc-157','BPC-157'],['tb-500','TB-500'],['ipamorelin','Ipamorelin'],['ghk-cu','GHK-Cu']])+
        '<div class="lib-links" style="margin-top:8px;"><a class="lib-link" href="/research/a-z">'+ic('<path d="M3 6h18M3 12h18M3 18h18"/>')+'Browse The Full A-Z Library</a></div></div>');
      var rc=qs('#s10 button.btn-ghost'); if(rc&&rc.parentNode){ rc.parentNode.insertBefore(cl,rc); } else { qs('#s10').appendChild(cl); }
    }
  }

  /* ===================================================================
     ANIMATIONS
     =================================================================== */
  function fixLockKey(){
    var instr=qs('#lkInstr'); if(instr) instr.textContent='Tap The Peptide To Bind It Into The Lock';
    var eff=qs('#lkEffect'); if(eff && /drag/i.test(eff.textContent||'')) eff.textContent='Tap The Blue Peptide To See What Happens When It Binds.';
    // inject cascade line + signal dot into arena
    var arena=qs('#lkArena'); if(arena && !qs('#lkSignal')){
      var dot=el('<div id="lkSignal" style="position:absolute;width:10px;height:10px;border-radius:50%;background:var(--teal);box-shadow:0 0 10px var(--teal);opacity:0;left:0;top:0;pointer-events:none;transition:transform 1s ease,opacity .3s;"></div>');
      arena.style.position='relative'; arena.appendChild(dot);
    }
    var card=qs('#s3 .card'); // first card holds the demo
  }
  window.bindPeptide=function(){
    var p=qs('#lkPeptide'), r=qs('#lkReceptor'), eff=qs('#lkEffect'), instr=qs('#lkInstr');
    if(p && p.dataset.bound) return; if(p) p.dataset.bound='1';
    if(p){ p.style.transition='transform .5s ease'; p.style.transform=RM?'':'translateY(-22px) scale(.85)'; }
    setTimeout(function(){
      if(r){ r.classList.add('bound'); r.style.borderColor='var(--teal)'; r.style.background='rgba(0,196,188,.14)'; }
      if(instr) instr.textContent='Bound - The Lock Is Activated';
      // signal cascade
      var steps=['Key Fits The Lock','Lock Changes Shape','Signal Travels Into The Cell','The Cell Responds'];
      if(eff){ eff.innerHTML='<strong style="color:var(--teal);">Receptor Activated</strong><div class="lk-cascade" id="lkCascade"></div>'; }
      var dot=qs('#lkSignal');
      steps.forEach(function(s,k){ setTimeout(function(){ var c=qs('#lkCascade'); if(c) c.textContent=s; if(dot && !RM){ dot.style.opacity='1'; dot.style.transform='translate('+(40+k*26)+'px,'+(k*8)+'px)'; if(k===steps.length-1){ setTimeout(function(){dot.style.opacity='0';},700);} } },RM?0:k*650); });
    },RM?0:500);
  };

  window.resetBinding=function(){
    try{boundState=false;}catch(e){}
    var p=qs('#lkPeptide'), r=qs('#lkReceptor'), eff=qs('#lkEffect'), instr=qs('#lkInstr'), dot=qs('#lkSignal');
    if(p){ p.dataset.bound=''; p.style.transform=''; }
    if(r){ r.classList.remove('bound'); r.style.borderColor=''; r.style.background=''; }
    if(instr) instr.textContent='Tap The Peptide To Bind It Into The Lock';
    if(eff) eff.textContent='Tap The Blue Peptide To See What Happens When It Binds.';
    if(dot){ dot.style.opacity='0'; dot.style.transform=''; }
  };

  function buildBondViz(){
    var card=qsa('#s2 .card').filter(function(c){return /What Is A Peptide Bond/i.test(c.textContent);})[0]; if(!card) return;
    var v=el('<div class="bondviz"><svg viewBox="0 0 340 120"><defs><radialGradient id="bvA" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#7fe9e2"/><stop offset="100%" stop-color="#009e96"/></radialGradient></defs>'+
      '<g class="bv-aa bv-left"><circle cx="118" cy="60" r="26" fill="url(#bvA)" stroke="#cfe0f5" stroke-width="1.5"/><text x="118" y="64" text-anchor="middle" font-size="12" fill="#04201e" font-family="Inter,sans-serif" font-weight="700">AA</text></g>'+
      '<g class="bv-aa bv-right"><circle cx="222" cy="60" r="26" fill="url(#bvA)" stroke="#cfe0f5" stroke-width="1.5"/><text x="222" y="64" text-anchor="middle" font-size="12" fill="#04201e" font-family="Inter,sans-serif" font-weight="700">AA</text></g>'+
      '<line class="bv-bond" x1="150" y1="60" x2="190" y2="60" stroke="var(--teal)" stroke-width="4" stroke-linecap="round"/>'+
      '<g class="bv-water"><circle cx="170" cy="60" r="9" fill="#5ea0ff"/><text x="170" y="64" text-anchor="middle" font-size="9" fill="#04122b" font-family="Inter,sans-serif" font-weight="700">H2O</text></g></svg>'+
      '<button class="btn btn-secondary" style="margin-top:6px;min-height:42px;font-size:13px;" id="bondPlay">Watch A Bond Form</button></div>');
    card.appendChild(v);
    qs('#bondPlay').addEventListener('click',function(){ v.classList.remove('run','fade'); void v.offsetWidth; v.classList.add('run'); if(!RM) setTimeout(function(){v.classList.add('fade');},2200); });
  }

  function buildDecay(){
    var host=qs('#hlResult'); if(!host || qs('#decayWrap')) return;
    var w=el('<div class="decay-wrap" id="decayWrap"><svg viewBox="0 0 300 130" preserveAspectRatio="none" style="height:130px;"><defs><linearGradient id="decayGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,196,188,.5)"/><stop offset="100%" stop-color="rgba(0,196,188,0)"/></linearGradient></defs>'+
      '<line x1="6" y1="112" x2="294" y2="112" stroke="rgba(150,170,200,.3)" stroke-width="1"/>'+
      '<line x1="6" y1="10" x2="6" y2="112" stroke="rgba(150,170,200,.3)" stroke-width="1"/>'+
      '<path class="decay-fill" id="decayFill" d=""/><path class="decay-curve" id="decayCurve" d=""/>'+
      '<g class="decay-half" id="decayHalf"><line x1="0" y1="0" x2="0" y2="0" stroke="var(--blue-l)" stroke-width="1.5" stroke-dasharray="4,3"/><text x="0" y="0" font-size="9" fill="#9fc4ff" font-family="Inter,sans-serif">50% (1 Half-Life)</text></g></svg>'+
      '<div style="font-size:11px;color:var(--muted);margin-top:6px;text-align:center;">Amount In The Body Over Time - It Halves Every Half-Life.</div></div>');
    host.appendChild(w);
  }
  window.showHL=function(name,hours,color){
    if(__origShowHL) __origShowHL(name,hours,color);
    var w=qs('#decayWrap'); if(!w) return;
    var W=288,H=102,x0=6,y0=10; // plot area: x 6..294, y 10..112
    var k=Math.log(2)/hours; var pts=[];
    for(var i=0;i<=60;i++){ var t=i/60*(hours*5); var y=Math.exp(-k*t); pts.push([x0+(t/(hours*5))*W, y0+(1-y)*H]); }
    var d=pts.map(function(p,i){return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' ');
    var fill=d+' L294 112 L6 112 Z';
    qs('#decayCurve').setAttribute('d',d); qs('#decayCurve').setAttribute('stroke',color||'#00C4BC');
    qs('#decayFill').setAttribute('d',fill);
    var hx=x0+(hours/(hours*5))*W, hy=y0+(1-0.5)*H;
    var g=qs('#decayHalf'); var ln=g.querySelector('line'), tx=g.querySelector('text');
    ln.setAttribute('x1',hx);ln.setAttribute('x2',hx);ln.setAttribute('y1',y0);ln.setAttribute('y2',112);
    tx.setAttribute('x',Math.min(hx+4,210));tx.setAttribute('y',hy-4);
    w.classList.remove('run'); void w.offsetWidth; w.classList.add('run');
  };

  function buildVial(){
    var card=qsa('#s8 .card').filter(function(c){return /Interactive Calculator/i.test(c.textContent);})[0]; if(!card || qs('#vialViz')) return;
    var v=el('<div class="vialviz" id="vialViz"><svg width="64" height="120" viewBox="0 0 64 120"><rect x="20" y="6" width="24" height="10" rx="2" fill="#9aa7b6"/><rect x="16" y="16" width="32" height="98" rx="10" fill="none" stroke="#9aa7b6" stroke-width="2.5"/><clipPath id="vialClip"><rect x="18" y="18" width="28" height="94" rx="8"/></clipPath><rect class="vial-liquid" id="vialLiquid" x="18" y="112" width="28" height="0" fill="url(#decayGrad2)" clip-path="url(#vialClip)"/><defs><linearGradient id="decayGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2de0d8"/><stop offset="100%" stop-color="#009e96"/></linearGradient></defs></svg>'+
      '<div class="conc-meter"><div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Strength Of The Final Liquid</div><div class="conc-track"><div class="conc-bar" id="concBar"></div></div><div class="conc-label"><span>Weak</span><span>Strong</span></div><div class="conc-strength" id="concStrength" style="color:var(--teal);"></div></div></div>');
    card.appendChild(v);
  }
  function updateVial(){
    var bar=qs('#concBar'), liq=qs('#vialLiquid'), st=qs('#concStrength'); if(!bar) return;
    var conc=parseFloat((qs('#calcConc')||{}).value)||1000;
    var pct=Math.max(6,Math.min(100,Math.round(conc/2500*100)));
    bar.style.width=pct+'%';
    var col = conc<800?'#2de0d8':conc<1800?'#00C4BC':'#3B82F6';
    bar.style.background='linear-gradient(90deg,'+col+',#9fc4ff)';
    if(liq){ var h=Math.max(10,94*pct/100); liq.setAttribute('height',h); liq.setAttribute('y',112-h); liq.setAttribute('fill',col); }
    if(st) st.textContent=conc+' mcg/mL'+(conc<800?' (Gentle)':conc<1800?' (Standard)':' (Concentrated)');
  }
  window.calcRecon=function(){ if(__origCalc) __origCalc(); updateVial(); };

  function buildBodyMap(){
    var sc=qs('#s6'); if(!sc || qs('#bodyMap')) return;
    var fig='<div class="bodymap-fig"><svg viewBox="0 0 120 240">'+
      '<circle class="bm-region" data-bm="brain" cx="60" cy="26" r="17"/>'+
      '<rect class="bm-region" data-bm="gh" x="50" y="40" width="20" height="14" rx="5"/>'+
      '<path class="bm-region" data-bm="skin" d="M38 60 q22 -10 44 0 v14 q-22 8 -44 0 z"/>'+
      '<rect class="bm-region" data-bm="muscle" x="40" y="78" width="40" height="46" rx="12"/>'+
      '<rect class="bm-region" data-bm="fat" x="44" y="126" width="32" height="30" rx="11"/>'+
      '<rect x="50" y="158" width="9" height="60" rx="4" fill="rgba(94,160,255,.10)" stroke="rgba(150,170,200,.4)" stroke-width="1.2"/>'+
      '<rect x="61" y="158" width="9" height="60" rx="4" fill="rgba(94,160,255,.10)" stroke="rgba(150,170,200,.4)" stroke-width="1.2"/>'+
      '</svg></div>';
    var info='<div class="bm-info" id="bmInfo"><h4>Tap A Region</h4><p>Tap A Highlighted Part Of The Body To See Which Peptide Family Works There.</p></div>';
    var wrap=el('<div class="card" id="bodyMap"><div class="section-h" style="justify-content:flex-start;margin:0 0 12px;"><span style="font-size:15px;font-weight:700;color:#eaf2fb;">Where Each Family Works</span></div><div class="bodymap">'+fig+info+'</div></div>');
    var nc=sc.querySelector('.nav-ctrl'); if(nc) sc.insertBefore(wrap,nc); else sc.appendChild(wrap);
    qsa('#bodyMap .bm-region').forEach(function(reg){ reg.addEventListener('click',function(){ var id=reg.dataset.bm; var d=BODY.filter(function(b){return b.id===id;})[0]; if(!d) return; qsa('#bodyMap .bm-region').forEach(function(x){x.classList.remove('active');}); reg.classList.add('active'); qs('#bmInfo').innerHTML='<h4>'+d.label+'</h4><p><strong style="color:var(--teal);">'+d.fam+':</strong> '+d.desc+'</p><div class="bm-chips">'+d.chips.map(function(c){return '<a class="lib-link" href="/research/compounds/'+c[0]+'">'+c[1]+'</a>';}).join('')+'</div>'; }); });
  }

  /* ===================================================================
     INLINE GLOSSARY TOOLTIPS
     =================================================================== */
  var GLOSS=(typeof glossaryTerms!=='undefined')?glossaryTerms:[];
  var popEl;
  function tipShow(e,term){ var d=GLOSS.filter(function(g){return g.term.toLowerCase()===term.toLowerCase();})[0]; if(!d) return; if(!popEl){popEl=el('<div class="gloss-pop"></div>');document.body.appendChild(popEl);} popEl.innerHTML='<b>'+d.term+'</b>'+d.def; var r=e.target.getBoundingClientRect(); popEl.style.left=Math.max(10,Math.min(window.innerWidth-290,r.left))+'px'; popEl.style.top=(r.bottom+8)+'px'; popEl.classList.add('show'); }
  function tipHide(){ if(popEl) popEl.classList.remove('show'); }
  function glossTooltips(){
    var terms=GLOSS.map(function(g){return g.term.replace(/\s*\(.*\)/,'').trim();}).filter(function(t){return t.length>3;}).sort(function(a,b){return b.length-a.length;});
    CONTENT.concat(['s0']).forEach(function(id){
      var sc=document.getElementById(id); if(!sc) return; var used={};
      terms.forEach(function(term){
        if(used[term.toLowerCase()]) return;
        var rx=new RegExp('\\b'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
        var walker=document.createTreeWalker(sc,NodeFilter.SHOW_TEXT,{acceptNode:function(n){ if(!n.nodeValue||!rx.test(n.nodeValue)) return NodeFilter.FILTER_REJECT; var p=n.parentNode; if(!p) return NodeFilter.FILTER_REJECT; var tag=p.nodeName.toLowerCase(); if(['a','button','script','style','strong','h1','h2','h3','h4','svg','text'].indexOf(tag)>-1) return NodeFilter.FILTER_REJECT; if(p.closest && (p.closest('.gloss-link')||p.closest('.badge')||p.closest('.nav-ctrl')||p.closest('.takeaways')||p.closest('.refs')||p.closest('.why-hook'))) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; }},false);
        var node=walker.nextNode(); if(!node) return;
        var m=node.nodeValue.match(rx); if(!m) return; var idx=node.nodeValue.toLowerCase().indexOf(m[0].toLowerCase());
        var after=node.splitText(idx); var word=after.splitText(m[0].length);
        var span=el('<span class="gloss-link" tabindex="0" data-term="'+m[0]+'">'+m[0]+'</span>');
        after.parentNode.replaceChild(span,after);
        used[term.toLowerCase()]=1;
      });
    });
    document.addEventListener('mouseover',function(e){ if(e.target.classList&&e.target.classList.contains('gloss-link')) tipShow(e,e.target.dataset.term); });
    document.addEventListener('mouseout',function(e){ if(e.target.classList&&e.target.classList.contains('gloss-link')) tipHide(); });
    document.addEventListener('click',function(e){ if(e.target.classList&&e.target.classList.contains('gloss-link')){ tipShow(e,e.target.dataset.term); setTimeout(tipHide,2600);} });
    document.addEventListener('focusin',function(e){ if(e.target.classList&&e.target.classList.contains('gloss-link')) tipShow(e,e.target.dataset.term); });
    document.addEventListener('focusout',function(e){ if(e.target.classList&&e.target.classList.contains('gloss-link')) tipHide(); });
  }

  /* ===================================================================
     REFERENCES MODAL (Omega Protocol via /api/proxy)
     =================================================================== */
  var refModal;
  function buildRefModal(){
    if(refModal) return;
    refModal=el('<div class="ref-modal" id="refModal"><div class="ref-modal-bar"><span class="t" id="refTitle"></span><span class="src" id="refSrc"></span><button class="ref-x" onclick="P101.closeRef()" aria-label="Close">'+ic('<path d="M18 6 6 18M6 6l12 12"/>')+'</button></div><iframe id="refFrame" title="Reference" referrerpolicy="no-referrer"></iframe></div>');
    document.body.appendChild(refModal);
  }
  function openRef(encUrl,title,src){ buildRefModal(); var url=decodeURIComponent(encUrl); qs('#refTitle').textContent=title||'Reference'; qs('#refSrc').textContent=src||''; qs('#refFrame').src='/api/proxy?url='+encodeURIComponent(url); refModal.classList.add('show'); document.body.style.overflow='hidden'; }
  function closeRef(){ if(refModal){ refModal.classList.remove('show'); qs('#refFrame').src='about:blank'; document.body.style.overflow=''; } }

  /* ===================================================================
     ROADMAP REBUILD
     =================================================================== */
  function buildRoadmap(){
    var cards=qsa('#s0 .roadmap-card'); if(!cards.length) return;
    var icons={}, times={};
    ['s1','s2','s3','s4','s5','s6','s7','s8','s9'].forEach(function(id,i){ if(cards[i]){ var im=cards[i].querySelector('.rm-ic'); icons[id]=im?im.outerHTML:''; } });
    var container=cards[0].parentNode;
    cards.forEach(function(c){c.remove();});
    function row(id,num,iconHTML){ var r=REG[id]; return '<div class="roadmap-card" data-mod="'+id+'" role="button" tabindex="0" aria-label="Module '+num+': '+r.t+'" onclick="P101.go(\''+id+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();P101.go(\''+id+'\');}"><div class="rm-num">'+num+'</div>'+(iconHTML||ICN.s13.replace('<svg','<svg class=\"rm-ic\"'))+'<div class="rm-title">'+r.t+'</div><div class="rm-time">'+ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')+r.time+'</div><div class="rm-state"></div></div>'; }
    var html='';
    ['s1','s2','s3','s4','s5','s6','s7','s8','s9'].forEach(function(id){ html+=row(id,REG[id].n,icons[id]); });
    [['s11',ICN.s11],['s12',ICN.s12],['s13',ICN.s13],['s14',ICN.s14]].forEach(function(p){ html+=row(p[0],REG[p[0]].n,p[1].replace('<svg','<svg class="rm-ic"')); });
    // final certificate card
    html+='<div class="roadmap-card" data-mod="s15" role="button" tabindex="0" aria-label="Final Quiz And Certificate" onclick="P101.go(\'s15\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();P101.go(\'s15\');}" style="margin-bottom:0;"><div class="rm-num">'+ICN.cert.replace('<svg','<svg width="18" height="18"')+'</div>'+ICN.cert.replace('<svg','<svg class="rm-ic"')+'<div class="rm-title">Final Quiz And Certificate</div><div class="rm-time">'+ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')+'Quiz</div><div class="rm-state"></div></div>';
    container.insertAdjacentHTML('beforeend',html);
  }

  /* ===================================================================
     EXPOSE + INIT
     =================================================================== */
  window.P101={ next:next, prev:prev, go:goId, openRef:openRef, closeRef:closeRef, examPick:examPick, examSubmit:examSubmit, examRetry:examRetry, toCert:toCert };

  function updateOverviewStats(){
    var nums=qsa('#s0 .stat-bignum'); if(nums[0]) nums[0].textContent='13';
    var tb=qs('#s0 .time-big'); if(tb) tb.textContent='60 Min';
  }

  function init(){
    if(window.__p101init) return; window.__p101init=1;
    buildRefModal();
    buildNewModules();
    buildAssessment();
    CONTENT.forEach(injectMeta);
    enhanceCert();
    buildRoadmap();
    standardizeNav();
    fixLockKey(); buildBondViz(); buildDecay(); buildVial(); buildBodyMap(); updateVial();
    glossTooltips();
    updateOverviewStats();
    updateProgressUI();
    // order-aware keyboard nav (capture phase supersedes app.js handler)
    document.addEventListener('keydown',function(e){
      if(qs('#glossaryModal') && qs('#glossaryModal').style.display!=='none') return;
      if(refModal && refModal.classList.contains('show')){ if(e.key==='Escape'){closeRef();} return; }
      if(/input|textarea/i.test((document.activeElement||{}).tagName||'')) return;
      if(e.key==='ArrowRight'){ e.preventDefault(); e.stopImmediatePropagation(); next(); }
      else if(e.key==='ArrowLeft'){ e.preventDefault(); e.stopImmediatePropagation(); prev(); }
    },true);
    // ensure we are showing a valid screen
    showScreen(document.querySelector('.screen.active')?document.querySelector('.screen.active').id:'s0');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(init,0);});
  else setTimeout(init,0);
})();
