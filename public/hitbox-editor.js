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
    `;

    editorEl.innerHTML = `
      <div style="font-weight:bold; margin-bottom:12px; font-size:15px; border-bottom:1px solid #334155; padding-bottom:8px;">
        Hitbox Editor <span id="he-module-name" style="color:#38bdf8; float:right;">Loading...</span>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block; margin-bottom:4px; color:#94a3b8;">Select Hitbox:</label>
        <select id="he-select" style="width:100%; padding:6px; background:#0f172a; color:#f8fafc; border:1px solid #334155; border-radius:6px;"></select>
      </div>
      
      <div id="he-controls" style="display:none; gap:10px; flex-direction:column;">
        <div>
          <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:4px;"><span>Box Top (%)</span> <span id="he-top-val"></span></div>
          <input type="range" id="he-top" min="0" max="100" step="0.1" style="width:100%">
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:4px;"><span>Box Left (%)</span> <span id="he-left-val"></span></div>
          <input type="range" id="he-left" min="0" max="100" step="0.1" style="width:100%">
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:4px;"><span>Box Width (%)</span> <span id="he-width-val"></span></div>
          <input type="range" id="he-width" min="0" max="100" step="0.1" style="width:100%">
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:4px;"><span>Box Height (%)</span> <span id="he-height-val"></span></div>
          <input type="range" id="he-height" min="0" max="100" step="0.1" style="width:100%">
        </div>
        
        <div style="height:1px; background:#334155; margin:4px 0;"></div>
        
        <div>
          <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:4px;"><span>Dot Left (px)</span> <span id="he-dotl-val"></span></div>
          <input type="range" id="he-dotl" min="-50" max="100" step="1" style="width:100%">
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:4px;"><span>Dot Top (%)</span> <span id="he-dott-val"></span></div>
          <input type="range" id="he-dott" min="0" max="100" step="1" style="width:100%">
        </div>
      </div>

      <button id="he-export" style="margin-top:16px; width:100%; padding:8px; background:#0ea5e9; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
        Generate HTML
      </button>

      <textarea id="he-output" style="width:100%; height:80px; margin-top:12px; background:#0f172a; color:#a3e635; border:1px solid #334155; border-radius:6px; font-family:monospace; font-size:11px; display:none;" readonly></textarea>
    `;

    document.body.appendChild(editorEl);

    // 2. State
    let activePage = null;
    let hitboxes = [];
    let selectedBox = null;

    const selectEl = document.getElementById('he-select');
    const controlsEl = document.getElementById('he-controls');
    
    // Sliders
    const sTop = document.getElementById('he-top');
    const sLeft = document.getElementById('he-left');
    const sWidth = document.getElementById('he-width');
    const sHeight = document.getElementById('he-height');
    const sDotL = document.getElementById('he-dotl');
    const sDotT = document.getElementById('he-dott');

    // Values
    const vTop = document.getElementById('he-top-val');
    const vLeft = document.getElementById('he-left-val');
    const vWidth = document.getElementById('he-width-val');
    const vHeight = document.getElementById('he-height-val');
    const vDotL = document.getElementById('he-dotl-val');
    const vDotT = document.getElementById('he-dott-val');

    // Add outline style globally for the active box
    const style = document.createElement('style');
    style.innerHTML = `
      .he-active-box {
        outline: 2px dashed #f87171 !important;
        background: rgba(248, 113, 113, 0.2) !important;
        z-index: 9999 !important;
      }
    `;
    document.head.appendChild(style);

    // 3. Scanner to find active page and hitboxes
    setInterval(() => {
      // Find the currently active page (modules 1-14)
      const newActive = document.querySelector('.m1-page.active, .m2-page.active, .m3-page.active, .m4-page.active, .m5-page.active, .m6-page.active, .m7-page.active, .m8-page.active, .m9-page.active, .m10-page.active, div[id^="m11-p"]:not([style*="display: none"]), div[id^="m12-p"]:not([style*="display: none"]), div[id^="m13-p"]:not([style*="display: none"]), .m14-page.active');
      
      if (newActive && newActive !== activePage) {
        activePage = newActive;
        document.getElementById('he-module-name').textContent = activePage.id;
        
        // Find all hitboxes
        hitboxes = Array.from(activePage.querySelectorAll('[class*="-opt"]'));
        
        // Populate select
        selectEl.innerHTML = '<option value="">-- Select Hitbox --</option>';
        hitboxes.forEach((box, i) => {
          const opt = document.createElement('option');
          opt.value = i;
          // Clean up classname for display
          opt.textContent = \`Box \${i+1}: \` + box.className.replace('selected','').replace('wrong-opt','').trim();
          selectEl.appendChild(opt);
        });

        // Reset selection
        if (selectedBox) selectedBox.classList.remove('he-active-box');
        selectedBox = null;
        controlsEl.style.display = 'none';
        document.getElementById('he-output').style.display = 'none';
      }
    }, 500);

    // 4. Select a box
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

      // Read current values
      const comp = window.getComputedStyle(selectedBox);
      
      // We read inline styles first, fallback to computed percentages
      const parentW = selectedBox.parentElement.clientWidth;
      const parentH = selectedBox.parentElement.clientHeight;

      const parsePct = (inlineStr, compPx, parentDim) => {
        if (inlineStr && inlineStr.includes('%')) return parseFloat(inlineStr);
        return (parseFloat(compPx) / parentDim) * 100 || 0;
      };

      const curTop = parsePct(selectedBox.style.top, comp.top, parentH);
      const curLeft = parsePct(selectedBox.style.left, comp.left, parentW);
      const curWidth = parsePct(selectedBox.style.width, comp.width, parentW);
      const curHeight = parsePct(selectedBox.style.height, comp.height, parentH);

      sTop.value = curTop; vTop.textContent = curTop.toFixed(1) + '%';
      sLeft.value = curLeft; vLeft.textContent = curLeft.toFixed(1) + '%';
      sWidth.value = curWidth; vWidth.textContent = curWidth.toFixed(1) + '%';
      sHeight.value = curHeight; vHeight.textContent = curHeight.toFixed(1) + '%';

      // Dot filler reads from CSS variables if present, else defaults
      const dotL = selectedBox.style.getPropertyValue('--dot-left') || '10px';
      const dotT = selectedBox.style.getPropertyValue('--dot-top') || '50%';
      
      sDotL.value = parseFloat(dotL); vDotL.textContent = parseFloat(dotL) + 'px';
      sDotT.value = parseFloat(dotT); vDotT.textContent = parseFloat(dotT) + '%';
    });

    // 5. Update box on slider change
    const updateBox = () => {
      if (!selectedBox) return;
      
      selectedBox.style.top = sTop.value + '%';
      selectedBox.style.left = sLeft.value + '%';
      selectedBox.style.width = sWidth.value + '%';
      selectedBox.style.height = sHeight.value + '%';
      
      selectedBox.style.setProperty('--dot-left', sDotL.value + 'px');
      selectedBox.style.setProperty('--dot-top', sDotT.value + '%');

      vTop.textContent = sTop.value + '%';
      vLeft.textContent = sLeft.value + '%';
      vWidth.textContent = sWidth.value + '%';
      vHeight.textContent = sHeight.value + '%';
      vDotL.textContent = sDotL.value + 'px';
      vDotT.textContent = sDotT.value + '%';
    };

    sTop.addEventListener('input', updateBox);
    sLeft.addEventListener('input', updateBox);
    sWidth.addEventListener('input', updateBox);
    sHeight.addEventListener('input', updateBox);
    sDotL.addEventListener('input', updateBox);
    sDotT.addEventListener('input', updateBox);

    // 6. Export HTML
    document.getElementById('he-export').addEventListener('click', () => {
      if (!activePage) return;
      // Temporarily remove outline class so it doesn't get copied
      if (selectedBox) selectedBox.classList.remove('he-active-box');
      
      const html = activePage.outerHTML;
      const out = document.getElementById('he-output');
      out.style.display = 'block';
      out.value = html;
      out.select();
      
      // Restore outline
      if (selectedBox) selectedBox.classList.add('he-active-box');
      
      const btn = document.getElementById('he-export');
      btn.textContent = 'Copied to selection!';
      setTimeout(() => btn.textContent = 'Generate HTML', 2000);
    });
  });
}
