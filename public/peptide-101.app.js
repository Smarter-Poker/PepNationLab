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
  { term: "Amino Acid", def: "The Building Blocks Of Peptides And Proteins. There Are 20 Standard Amino Acids. Each Has A Unique Side Chain That Determines Its Chemical Properties." },
  { term: "Angiogenesis", def: "The Formation Of New Blood Vessels From Existing Ones. Some Peptides Are Studied For Their Ability To Promote Angiogenesis In Tissue Repair Research." },
  { term: "Bacteriostatic Water (BAC Water)", def: "Sterile Water Containing 0.9% Benzyl Alcohol. The Preservative Inhibits Microbial Growth, Extending The Shelf Life Of Reconstituted Peptides To 28-30 Days." },
  { term: "Conformation", def: "The 3D Shape A Peptide Or Protein Folds Into. Shape Determines Function - A Peptide Must Have The Right Conformation To Bind Its Receptor." },
  { term: "Cyclical Peptide", def: "A Peptide Where The Amino Acid Chain Forms A Ring Rather Than A Linear Sequence. Cyclic Peptides Are Often More Stable And Bioavailable. PT-141 Is An Example." },
  { term: "Fibroblast", def: "A Type Of Cell That Produces Collagen And Other Connective Tissue Components. A Key Cell Type In Tissue Repair Research." },
  { term: "GHRH", def: "Growth Hormone Releasing Hormone. An Endogenous Peptide Produced In The Hypothalamus That Stimulates The Pituitary To Release Growth Hormone. Sermorelin And CJC-1295 Are Synthetic Analogues." },
  { term: "GHS-R1a", def: "Growth Hormone Secretagogue Receptor 1a. The Receptor For Ghrelin And Ghrelin Mimetics Like Ipamorelin. Located On Pituitary Somatotrophs." },
  { term: "Half-Life", def: "The Time It Takes For The Concentration Of A Substance In The Body To Reduce By 50%. Short Half-Life Means More Frequent Dosing. Long Half-Life Means Less Frequent Dosing." },
  { term: "IGF-1", def: "Insulin-Like Growth Factor 1. A Hormone Produced Mainly By The Liver In Response To GH Stimulation. Most Anabolic Effects Attributed To GH Are Actually Mediated By IGF-1." },
  { term: "Lyophilization", def: "Freeze-Drying. The Process Of Removing Water From A Peptide Solution Under Vacuum, Leaving Behind A Stable Powder. Lyophilized Peptides Have A Much Longer Shelf Life Than Solutions." },
  { term: "Melanocortin Receptor", def: "A Family Of Receptors (MC1R-MC5R) That Respond To Melanocyte-Stimulating Hormone And Related Peptides Like PT-141. MC4R Is The Primary Target For Appetite And Sexual Function Research." },
  { term: "Peptide Bond", def: "The Covalent Chemical Bond Formed Between Two Amino Acids. Created When The Carboxyl Group (-COOH) Of One Amino Acid Reacts With The Amino Group (-NH2) Of Another, Releasing Water." },
  { term: "Pituitary Gland", def: "A Small Endocrine Gland At The Base Of The Brain. It Produces And Releases Many Hormones Including Growth Hormone (GH), LH, FSH, TSH, And ACTH." },
  { term: "Reconstitution", def: "The Process Of Dissolving A Lyophilized (Freeze-Dried) Peptide Powder In A Liquid Diluent - Usually BAC Water - To Create An Injectable Solution." },
  { term: "Somatotroph", def: "A Specialized Cell Type In The Anterior Pituitary Gland That Produces And Secretes Growth Hormone. GHRH Analogues And Ghrelin Mimetics Act Directly On Somatotrophs." },
  { term: "Sub-Q (Subcutaneous)", def: "Injection Into The Fatty Tissue Just Beneath The Skin. The Most Common Route Of Administration For Research Peptides. Typically Performed At A 45-Degree Angle With A Fine-Gauge Needle." },
  { term: "Thymosin Beta-4 (TB4)", def: "A Naturally Occurring Protein Found In Virtually All Human And Animal Cells. TB-500 Is A Synthetic Fragment Of Its Active Binding Domain. Involved In Actin Regulation And Cell Migration." },
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
    "BPC-157": "Short Half-Life. Multiple Daily Doses Used In Research Protocols To Maintain Plasma Levels.",
    "TB-500": "Long Half-Life Enables Twice-Weekly Dosing In Most Research Frameworks.",
    "Sermorelin": "Very Short. Must Be Timed Precisely. Typically Injected 30-60 min Before Sleep To Align With The Natural GH Pulse.",
    "Ipamorelin": "Moderate. Nightly Dosing Is Standard In GH Axis Research Protocols.",
    "CJC-1295 DAC": "Extremely Long Due To Albumin Binding. Once Or Twice Weekly Dosing Maintains Steady Plasma Levels And Creates Continuous GH Release."
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
