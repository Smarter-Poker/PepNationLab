if (window.location.search.includes('edit=1')) {
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Inject the UI
    const editorEl = document.createElement('div');
    editorEl.id = 'hitbox-editor';
    editorEl.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
      z-index: 999999;
      font-family: sans-serif;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      font-size: 13px;
      max-height: 90vh;
      overflow-y: auto;
    `;

    editorEl.innerHTML = `
      <div style="font-weight:bold; margin-bottom:12px; font-size:15px; border-bottom:1px solid #334155; padding-bottom:8px;">
        Hitbox Editor <span id="he-module-name" style="color:#38bdf8; float:right;">Loading...</span>
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block; margin-bottom:4px; color:#94a3b8; font-weight:bold;">1. Quick Jump to Quiz:</label>
        <select id="he-jump" style="width:100%; padding:6px; background:#0f172a; color:#f8fafc; border:1px solid #334155; border-radius:6px;">
          <option value="">-- Jump to Module --</option>
          <option value="1">Module 1 Quiz</option>
          <option value="2">Module 2 Quiz</option>
          <option value="3">Module 3 Quiz</option>
          <option value="4">Module 4 Quiz</option>
          <option value="5">Module 5 Quiz</option>
          <option value="6">Module 6 Quiz</option>
          <option value="7">Module 7 Quiz</option>
          <option value="8">Module 8 Quiz</option>
          <option value="9">Module 9 Quiz</option>
          <option value="10">Module 10 Quiz</option>
          <option value="11">Module 11 Quiz</option>
          <option value="12">Module 12 Quiz</option>
          <option value="13">Module 13 Quiz</option>
          <option value="14">Module 14 Quiz (Pg 2)</option>
          <option value="14.3">Module 14 Quiz (Pg 3)</option>
          <option value="14.4">Module 14 Quiz (Pg 4)</option>
          <option value="14.5">Module 14 Quiz (Pg 5)</option>
        </select>
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block; margin-bottom:4px; color:#94a3b8; font-weight:bold;">2. Select Hitbox to Edit:</label>
        <select id="he-select" style="width:100%; padding:6px; background:#0f172a; color:#f8fafc; border:1px solid #334155; border-radius:6px;"></select>
      </div>
      
      <div id="he-controls" style="display:none; gap:10px; flex-direction:column;">
        
        <div style="display:flex; gap:8px; margin-bottom:4px;">
          <button id="he-sim-correct" style="flex:1; padding:6px; background:#10b981; color:#fff; border:none; border-radius:4px; cursor:pointer;">Show Correct</button>
          <button id="he-sim-wrong" style="flex:1; padding:6px; background:#ef4444; color:#fff; border:none; border-radius:4px; cursor:pointer;">Show Incorrect</button>
          <button id="he-sim-clear" style="flex:1; padding:6px; background:#64748b; color:#fff; border:none; border-radius:4px; cursor:pointer;">Clear</button>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:4px;"><span>Box Top (%)</span> <span id="he-top-val"></span></div>
          <input type="range" id="he-top" min="0" max="100" step="0.1" style="width:100%">
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:4px;"><span>Box Left (%)</span> <span id="he-left-val"></span></div>
          <input type="range" id="he-left" min="0" max="100" step="0.1" style="width:100%">
        </div>
      </div>

      <button id="he-export" style="margin-top:16px; width:100%; padding:8px; background:#0ea5e9; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
        Generate HTML
      </button>

      <textarea id="he-output" style="width:100%; height:80px; margin-top:12px; background:#0f172a; color:#a3e635; border:1px solid #334155; border-radius:6px; font-family:monospace; font-size:11px; display:none;" readonly></textarea>
    `;

    document.body.appendChild(editorEl);

    let activePage = null;
    let hitboxes = [];
    let selectedBox = null;

    const selectEl = document.getElementById('he-select');
    const controlsEl = document.getElementById('he-controls');
    
    const sTop = document.getElementById('he-top');
    const sLeft = document.getElementById('he-left');

    const vTop = document.getElementById('he-top-val');
    const vLeft = document.getElementById('he-left-val');

    const style = document.createElement('style');
    style.innerHTML = `
      .he-active-box {
        outline: 2px dashed #f87171 !important;
        background: rgba(248, 113, 113, 0.2) !important;
        z-index: 9999 !important;
      }
    `;
    document.head.appendChild(style);

    setInterval(() => {
      const newActive = document.querySelector('.m1-page.active, .m2-page.active, .m3-page.active, .m4-page.active, .m5-page.active, .m6-page.active, .m7-page.active, .m8-page.active, .m9-page.active, .m10-page.active, div[id^="m11-p"]:not([style*="display: none"]), div[id^="m12-p"]:not([style*="display: none"]), div[id^="m13-p"]:not([style*="display: none"]), .m14-page.active');
      
      if (newActive && newActive !== activePage) {
        activePage = newActive;
        document.getElementById('he-module-name').textContent = activePage.id;
        
        hitboxes = Array.from(activePage.querySelectorAll('[class*="-opt"]'));
        
        selectEl.innerHTML = '<option value="">-- Select Hitbox --</option>';
        hitboxes.forEach((box, i) => {
          const opt = document.createElement('option');
          opt.value = i;
          opt.textContent = `Box ${i+1}: ` + box.className.replace('selected','').replace('wrong-opt','').trim();
          selectEl.appendChild(opt);
        });

        if (selectedBox) selectedBox.classList.remove('he-active-box');
        selectedBox = null;
        controlsEl.style.display = 'none';
        document.getElementById('he-output').style.display = 'none';
      }
    }, 500);

    document.getElementById('he-jump').addEventListener('change', (e) => {
      let mod = e.target.value;
      if (!mod) return;
      
      let pg = 5;
      if(mod.includes('.')) {
        let parts = mod.split('.');
        mod = parts[0];
        pg = parseInt(parts[1]);
      }

      // Hide all modals/overlays just in case
      document.getElementById('roadmap').classList.remove('active');

      // 1. Force open the module's main #sX screen! This was missing and caused the blank screen.
      if (window.goTo) window.goTo(parseInt(mod));

      // 2. Hide all pages inside the course
      document.querySelectorAll('[class*="-page"]').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('div[id^="m11-p"], div[id^="m12-p"], div[id^="m13-p"]').forEach(el => el.style.display = 'none');

      // 3. Show requested quiz page
      let target;
      if (['11','12','13'].includes(mod)) {
        target = document.getElementById(`m${mod}-p${pg}`);
        if (target) target.style.display = 'block';
      } else {
        target = document.getElementById(`m${mod}p${pg}`);
        if (target) target.classList.add('active');
      }
    });

    selectEl.addEventListener('change', (e) => {
      if (selectedBox) selectedBox.classList.remove('he-active-box');
      
      const idx = e.target.value;
      if (idx === '') {
        selectedBox = null;
        controlsEl.style.display = 'none';
        return;
      }

      selectedBox = hitboxes[idx];
      selectedBox.classList.add('he-active-box');
      controlsEl.style.display = 'flex';

      const comp = window.getComputedStyle(selectedBox);
      const parentW = selectedBox.parentElement.clientWidth;
      const parentH = selectedBox.parentElement.clientHeight;

      const parsePct = (inlineStr, compPx, parentDim) => {
        if (inlineStr && inlineStr.includes('%')) return parseFloat(inlineStr);
        return (parseFloat(compPx) / parentDim) * 100 || 0;
      };

      const curTop = parsePct(selectedBox.style.top, comp.top, parentH);
      const curLeft = parsePct(selectedBox.style.left, comp.left, parentW);

      sTop.value = curTop; vTop.textContent = curTop.toFixed(1) + '%';
      sLeft.value = curLeft; vLeft.textContent = curLeft.toFixed(1) + '%';
    });

    const updateBox = () => {
      if (!selectedBox) return;
      
      selectedBox.style.top = sTop.value + '%';
      selectedBox.style.left = sLeft.value + '%';

      vTop.textContent = sTop.value + '%';
      vLeft.textContent = sLeft.value + '%';
    };

    sTop.addEventListener('input', updateBox);
    sLeft.addEventListener('input', updateBox);

    // Color toggles
    document.getElementById('he-sim-correct').addEventListener('click', () => {
      if (!selectedBox) return;
      selectedBox.classList.remove('wrong-opt');
      selectedBox.classList.add('selected');
    });
    document.getElementById('he-sim-wrong').addEventListener('click', () => {
      if (!selectedBox) return;
      selectedBox.classList.remove('selected');
      selectedBox.classList.add('wrong-opt');
    });
    document.getElementById('he-sim-clear').addEventListener('click', () => {
      if (!selectedBox) return;
      selectedBox.classList.remove('selected', 'wrong-opt');
    });

    document.getElementById('he-export').addEventListener('click', () => {
      if (!activePage) return;
      if (selectedBox) selectedBox.classList.remove('he-active-box');
      
      // Clear simulations before export so it doesn't hardcode them
      hitboxes.forEach(b => b.classList.remove('selected', 'wrong-opt'));

      const html = activePage.outerHTML;
      const out = document.getElementById('he-output');
      out.style.display = 'block';
      out.value = html;
      out.select();
      
      if (selectedBox) selectedBox.classList.add('he-active-box');
      
      const btn = document.getElementById('he-export');
      btn.textContent = 'Copied to selection!';
      setTimeout(() => btn.textContent = 'Generate HTML', 2000);
    });
  });
}
