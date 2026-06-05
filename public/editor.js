/* =====================================================================
 * editor.js — schematic editor + UI + real-time clock + instruments
 * ===================================================================== */
(function () {
  'use strict';
  const TYPES = window.Components.TYPES;
  const NCH = window.Components.NCH;
  const I18n = window.I18n;
  const t = (k, v) => I18n.t(k, v);
  const GRID = 20;

  // ---------- state ----------
  const state = {
    components: [], wires: [], selected: null, placing: null,
    wiring: null, drag: null, running: false, sim: null, idc: 1,
    mouse: { x: 0, y: 0 }
  };

  const $ = (s) => document.querySelector(s);
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');

  // ---------- geometry ----------
  function rot(x, y, deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c };
  }
  function absPin(comp, i) {
    const p = TYPES[comp.type].pins[i];
    const r = rot(p.x, p.y, comp.rot);
    return { x: comp.x + r.x, y: comp.y + r.y };
  }
  const compById = (id) => state.components.find(c => c.id === id);
  const snap = (v) => Math.round(v / GRID) * GRID;

  // ---------- add / delete ----------
  function addComponent(type, x, y) {
    const tdef = TYPES[type];
    const c = {
      id: state.idc++, type, x: snap(x), y: snap(y), rot: 0,
      props: JSON.parse(JSON.stringify(tdef.props || {}))
    };
    state.components.push(c);
    return c;
  }
  function deleteComponent(id) {
    state.components = state.components.filter(c => c.id !== id);
    state.wires = state.wires.filter(w => w.a.comp !== id && w.b.comp !== id);
    if (state.selected === id) state.selected = null;
  }

  // ---------- hit testing ----------
  function pinAt(mx, my) {
    let best = null, bd = 10;
    for (const c of state.components) {
      TYPES[c.type].pins.forEach((_, i) => {
        const p = absPin(c, i);
        const d = Math.hypot(p.x - mx, p.y - my);
        if (d < bd) { bd = d; best = { comp: c.id, pin: i }; }
      });
    }
    return best;
  }
  function compAt(mx, my) {
    for (let k = state.components.length - 1; k >= 0; k--) {
      const c = state.components[k]; const tt = TYPES[c.type];
      const d = rot(mx - c.x, my - c.y, -c.rot);
      if (Math.abs(d.x) <= tt.w / 2 + 4 && Math.abs(d.y) <= tt.h / 2 + 4) return c;
    }
    return null;
  }

  // ===================================================================
  // SIMULATION + REAL-TIME CLOCK
  // ===================================================================
  const clock = { raf: null, last: 0, t: 0 };

  function simulateOnce() {
    try { state.sim = window.Netlist.simulate(state.components, state.wires); }
    catch (e) { console.error(e); setStatus(t('ui.simError', { msg: e.message })); state.sim = null; }
  }
  function statusFromSim() {
    if (!state.sim) return;
    const w = state.sim.warnings || [];
    setStatus(state.sim.ok ? (t('ui.simRunning') + (w.length ? ' — ' + w.join(' ') : '')) : t('ui.solveError'));
  }
  function hasInstrument(kind) { return state.components.some(c => TYPES[c.type].instrument === kind); }
  function needsClock() { return state.components.some(c => TYPES[c.type].instrument); }

  function resetInstruments() {
    for (const c of state.components) {
      const tt = TYPES[c.type];
      if (tt.instrument === 'generator') { c._idx = 0; c._acc = 0; c._playing = true; }
      if (tt.instrument === 'analyzer') { c._samples = []; }
    }
    clock.t = 0;
  }

  function run() {
    state.running = true;
    resetInstruments();
    simulateOnce(); statusFromSim();
    $('#btnRun').disabled = true; $('#btnStop').disabled = false;
    updateDock();
    if (needsClock()) startClock();
    render(); renderProps();
  }
  function stop() {
    stopClock();
    state.running = false; state.sim = null;
    state.components.forEach(c => {
      ['_on', '_I', '_reading', '_bright', '_lvl', '_srcI', '_cur', '_levels'].forEach(k => delete c[k]);
    });
    $('#btnRun').disabled = false; $('#btnStop').disabled = true;
    setStatus(t('ui.stopped'));
    updateDock();
    render(); renderProps();
  }
  function resimIfRunning() { if (state.running) { simulateOnce(); render(); } else render(); autosave(); }

  // setInterval-driven (keeps running in background tabs; rAF is paused when hidden)
  function startClock() { stopClock(); clock.last = performance.now(); clock.raf = setInterval(loop, 33); }
  function stopClock() { if (clock.raf) clearInterval(clock.raf); clock.raf = null; }
  function loop() {
    const now = performance.now();
    let dt = (now - clock.last) / 1000; clock.last = now;
    if (dt > 0.2) dt = 0.2;
    clock.t += dt;
    try {
      advanceGenerators(dt);
      simulateOnce();
      sampleAnalyzers(clock.t);
      render();
      drawAnalyzers();
    } catch (e) { console.error('clock loop error:', e); }
  }

  function advanceGenerators(dt) {
    for (const c of state.components) {
      if (TYPES[c.type].instrument !== 'generator') continue;
      const pats = c.props.patterns || [];
      const n = pats.length;
      if (n === 0) { c._idx = 0; continue; }
      if (c._idx >= n) c._idx = 0;
      const mode = c.props.mode || 'cycle';
      if (mode === 'step') continue;
      if (mode === 'burst' && c._playing === false) continue;
      const period = 1 / Math.max(0.05, +c.props.freq || 1);
      c._acc = (c._acc || 0) + dt;
      while (c._acc >= period) {
        c._acc -= period;
        if (mode === 'cycle') c._idx = (c._idx + 1) % n;
        else if (mode === 'burst') { if (c._idx < n - 1) c._idx++; else { c._playing = false; break; } }
      }
    }
  }

  function sampleAnalyzers(time) {
    for (const c of state.components) {
      if (TYPES[c.type].instrument !== 'analyzer') continue;
      if (!c._samples) c._samples = [];
      let v = 0; const lv = c._levels || [];
      for (let i = 0; i < NCH; i++) if (lv[i]) v |= (1 << i);
      const last = c._samples[c._samples.length - 1];
      c._samples.push({ t: time, v });
      const win = Math.max(1, +c.props.window || 8);
      while (c._samples.length > 2 && c._samples[0].t < time - win * 2.2) c._samples.shift();
      if (c._samples.length > 6000) c._samples.shift();
    }
  }

  // ---------- analyzer dock ----------
  function currentAnalyzer() {
    if (state.selected != null) {
      const c = compById(state.selected);
      if (c && TYPES[c.type].instrument === 'analyzer') return c;
    }
    return state.components.find(c => TYPES[c.type].instrument === 'analyzer') || null;
  }
  function updateDock() {
    const dock = $('#ladock');
    const show = state.running && hasInstrument('analyzer');
    dock.classList.toggle('hidden', !show);
    setTimeout(() => { resize(); resizeLaCanvas(); drawAnalyzers(); }, 0);
  }
  function resizeLaCanvas() {
    const cv = $('#laCanvas'); const r = cv.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height - 38));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  function drawAnalyzers() {
    const dock = $('#ladock'); if (dock.classList.contains('hidden')) return;
    const cv = $('#laCanvas'); const x = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H); x.fillStyle = '#0b0e14'; x.fillRect(0, 0, W, H);
    const c = currentAnalyzer();
    if (!c || !c._samples || c._samples.length < 2) {
      x.fillStyle = '#6e7681'; x.font = '12px monospace'; x.textAlign = 'left';
      x.fillText(t('la.nodata'), 12, 22); return;
    }
    const win = Math.max(1, +c.props.window || 8);
    const tEnd = clock.t, tStart = tEnd - win;
    const labelW = 44, plotW = W - labelW - 8, rows = NCH, rowH = (H - 8) / rows;
    const sx = (tt) => labelW + ((tt - tStart) / win) * plotW;
    for (let ch = 0; ch < rows; ch++) {
      const y0 = 4 + ch * rowH, hi = y0 + rowH * 0.2, lo = y0 + rowH * 0.8;
      x.fillStyle = '#7a8699'; x.font = '9px monospace'; x.textAlign = 'left';
      x.fillText('D' + ch, 4, y0 + rowH * 0.64);
      x.strokeStyle = '#13192400'; x.strokeStyle = '#161b22';
      x.beginPath(); x.moveTo(labelW, y0 + rowH); x.lineTo(W, y0 + rowH); x.stroke();
      x.strokeStyle = '#39d353'; x.lineWidth = 1.4; x.beginPath();
      let started = false, prevY = null;
      for (let i = 0; i < c._samples.length; i++) {
        const s = c._samples[i]; if (s.t < tStart) continue;
        const bit = (s.v >> ch) & 1; const yy = bit ? hi : lo;
        let xx = sx(s.t); if (xx < labelW) xx = labelW; if (xx > W) xx = W;
        if (!started) { x.moveTo(xx, yy); started = true; prevY = yy; }
        else { if (yy !== prevY) { x.lineTo(xx, prevY); x.lineTo(xx, yy); } else x.lineTo(xx, yy); prevY = yy; }
      }
      if (started) x.lineTo(Math.min(W, sx(tEnd)), prevY);
      x.stroke();
    }
  }

  function nodeVoltage(comp, pin) {
    if (!state.sim || !comp._nodes) return null;
    return state.sim.nodeV[comp._nodes[pin]];
  }

  // ===================================================================
  // RENDERING
  // ===================================================================
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h; render();
  }
  window.addEventListener('resize', () => { resize(); resizeLaCanvas(); drawAnalyzers(); });
  window.addEventListener('load', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement);

  function voltColor(v) {
    if (v == null) return null;
    const tt = Math.max(-1, Math.min(1, v / 6));
    if (tt >= 0) { const g = Math.round(255 * (1 - tt)); return `rgb(255,${g},${g})`; }
    const g = Math.round(255 * (1 + tt)); return `rgb(${g},${g},255)`;
  }

  function render() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0e14'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a2130';
    for (let x = 0; x < W; x += GRID) for (let y = 0; y < H; y += GRID) ctx.fillRect(x, y, 1, 1);

    // wires
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (const w of state.wires) {
      const ca = compById(w.a.comp), cb = compById(w.b.comp);
      if (!ca || !cb) continue;
      const a = absPin(ca, w.a.pin), b = absPin(cb, w.b.pin);
      let col = '#6e7681';
      if (state.running) { const vc = voltColor(nodeVoltage(ca, w.a.pin)); if (vc) col = vc; }
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    if (state.wiring) {
      const c = compById(state.wiring.comp); const a = absPin(c, state.wiring.pin);
      ctx.strokeStyle = '#39d353'; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(state.mouse.x, state.mouse.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const c of state.components) {
      const tt = TYPES[c.type];
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.rot * Math.PI / 180);
      ctx.strokeStyle = '#cdd9e5'; ctx.fillStyle = '#cdd9e5'; ctx.lineWidth = 2; ctx.font = '11px monospace';
      ctx.textAlign = 'start';
      tt.draw(ctx, c);
      ctx.restore();

      if (state.selected === c.id) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot * Math.PI / 180);
        ctx.strokeStyle = '#2f81f7'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
        ctx.strokeRect(-tt.w / 2 - 3, -tt.h / 2 - 3, tt.w + 6, tt.h + 6);
        ctx.setLineDash([]); ctx.restore();
      }

      if (!tt.instrument) {
        ctx.fillStyle = '#8b95a5'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
        const lbl = labelFor(c);
        if (lbl) ctx.fillText(lbl, c.x, c.y + tt.h / 2 + 13);
        ctx.textAlign = 'start';
      }
    }

    for (const c of state.components) {
      TYPES[c.type].pins.forEach((_, i) => {
        const p = absPin(c, i);
        const hov = nearPin(p, state.mouse);
        ctx.fillStyle = hov ? '#39d353' : '#f0883e';
        ctx.beginPath(); ctx.arc(p.x, p.y, hov ? 4.5 : 3, 0, 7); ctx.fill();
      });
    }
  }
  function nearPin(p, m) { return Math.hypot(p.x - m.x, p.y - m.y) < 8; }

  function labelFor(c) {
    if (state.running) {
      if (c.type === 'voltmeter') return fmt(c._reading, 'V');
      if (c.type === 'ammeter') return fmt(c._reading, 'A');
    }
    if ('R' in c.props) return fmt(c.props.R, 'Ω');
    if ('V' in c.props) return fmt(c.props.V, 'V');
    if ('I' in c.props) return fmt(c.props.I, 'A');
    return '';
  }

  function fmt(v, unit) {
    if (v == null || isNaN(v)) return '—';
    const a = Math.abs(v); let s;
    if (a >= 1e6) s = (v / 1e6).toFixed(2) + ' M';
    else if (a >= 1e3) s = (v / 1e3).toFixed(2) + ' k';
    else if (a >= 1) s = v.toFixed(2) + ' ';
    else if (a >= 1e-3) s = (v * 1e3).toFixed(2) + ' m';
    else if (a >= 1e-6) s = (v * 1e6).toFixed(2) + ' µ';
    else s = v.toFixed(3) + ' ';
    return s + unit;
  }

  // ===================================================================
  // MOUSE / KEYBOARD
  // ===================================================================
  function getMouse(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('mousedown', (e) => {
    const m = getMouse(e); state.mouse = m;
    if (state.placing) {
      const c = addComponent(state.placing, m.x, m.y);
      state.selected = c.id;
      if (state.running && TYPES[c.type].instrument) { stopClock(); resetInstruments(); startClock(); }
      updateDock();
      resimIfRunning(); renderProps(); render();
      return;
    }
    const pin = pinAt(m.x, m.y);
    if (pin) {
      if (state.wiring) {
        if (state.wiring.comp !== pin.comp || state.wiring.pin !== pin.pin) {
          state.wires.push({ a: { ...state.wiring }, b: { ...pin } });
          resimIfRunning();
        }
        state.wiring = null;
      } else state.wiring = pin;
      render(); return;
    }
    const c = compAt(m.x, m.y);
    if (c) {
      state.wiring = null; state.selected = c.id;
      state.drag = { id: c.id, dx: m.x - c.x, dy: m.y - c.y, moved: false };
      renderProps(); render();
      if (TYPES[c.type].instrument === 'analyzer') updateDock();
    } else {
      state.selected = null; state.wiring = null; renderProps(); render();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const m = getMouse(e); state.mouse = m;
    if (state.drag) {
      const c = compById(state.drag.id);
      c.x = snap(m.x - state.drag.dx); c.y = snap(m.y - state.drag.dy);
      state.drag.moved = true;
      if (state.running && !clock.raf) simulateOnce();
      render();
    } else if (state.wiring || pinAt(m.x, m.y)) render();
  });

  window.addEventListener('mouseup', () => {
    if (state.drag) { if (state.drag.moved) autosave(); state.drag = null; }
  });

  canvas.addEventListener('dblclick', (e) => {
    const m = getMouse(e); const c = compAt(m.x, m.y); if (!c) return;
    const tt = TYPES[c.type];
    if (tt.toggle) { c.props.closed = !c.props.closed; resimIfRunning(); renderProps(); }
    else if (tt.toggleLogic) { c.props.state = c.props.state ? 0 : 1; resimIfRunning(); renderProps(); }
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape') { state.placing = null; state.wiring = null; setPaletteActive(null); render(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected != null) {
      deleteComponent(state.selected); updateDock(); resimIfRunning(); renderProps(); render();
    } else if (e.key === 'r' || e.key === 'R') rotateSelected();
  });

  function rotateSelected() {
    if (state.selected == null) return;
    const c = compById(state.selected); c.rot = (c.rot + 90) % 360;
    resimIfRunning(); render();
  }

  // ===================================================================
  // PALETTE
  // ===================================================================
  function buildPalette() {
    const pal = $('#palette'); pal.innerHTML = '';
    const cats = {};
    for (const key in TYPES) (cats[TYPES[key].cat] = cats[TYPES[key].cat] || []).push(key);
    const order = ['Sources', 'Passive', 'Indicators', 'Switches', 'Meters', 'Digital', 'Logic Gates', 'Instruments'];
    const catKeys = Object.keys(cats).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    for (const cat of catKeys) {
      const h = document.createElement('div'); h.className = 'cat'; h.textContent = I18n.cat(cat); pal.appendChild(h);
      for (const key of cats[cat]) {
        const tt = TYPES[key];
        const item = document.createElement('div');
        item.className = 'palette-item'; item.dataset.type = key;
        if (state.placing === key) item.classList.add('active');
        const mini = document.createElement('canvas'); mini.width = 46; mini.height = 34;
        drawMini(mini, tt);
        const span = document.createElement('span'); span.textContent = I18n.comp(key);
        item.appendChild(mini); item.appendChild(span);
        item.addEventListener('click', () => {
          state.placing = (state.placing === key) ? null : key;
          setPaletteActive(state.placing ? item : null);
          setStatus(state.placing ? t('ui.placing', { name: I18n.comp(key) }) : t('ui.ready'));
        });
        pal.appendChild(item);
      }
    }
  }
  function setPaletteActive(item) {
    document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('active'));
    if (item) item.classList.add('active');
  }
  function drawMini(cv, tt) {
    const c = cv.getContext('2d');
    c.translate(cv.width / 2, cv.height / 2);
    const s = Math.min(1, 40 / tt.w, 28 / tt.h);
    c.scale(s, s);
    c.strokeStyle = '#cdd9e5'; c.fillStyle = '#cdd9e5'; c.lineWidth = 2; c.font = '11px monospace';
    c.textAlign = 'start';
    try { tt.draw(c, { props: tt.props || {}, _on: false, _idx: 0 }); } catch (e) {}
  }

  // ===================================================================
  // PROPERTIES
  // ===================================================================
  function renderProps() {
    const body = $('#propsBody'); body.innerHTML = '';
    if (state.selected == null) { body.innerHTML = `<p class="muted">${t('ui.nothing_selected')}</p>`; return; }
    const c = compById(state.selected); const tt = TYPES[c.type];

    const title = document.createElement('div'); title.className = 'title'; title.textContent = I18n.comp(c.type);
    body.appendChild(title);

    if (tt.instrument === 'generator') { buildGeneratorProps(c, body); appendRotDel(body); return; }
    if (tt.instrument === 'analyzer') { buildAnalyzerProps(c, body); appendRotDel(body); return; }

    for (const key in c.props) {
      const val = c.props[key];
      const row = document.createElement('div'); row.className = 'prop-row';
      if (typeof val === 'boolean') {
        row.innerHTML = `<div class="toggle"><input type="checkbox" ${val ? 'checked' : ''}/> <label>${propLabel(key)}</label></div>`;
        row.querySelector('input').addEventListener('change', (e) => { c.props[key] = e.target.checked; resimIfRunning(); render(); });
      } else if (key === 'pos') {
        row.innerHTML = `<label>${propLabel(key)}: ${Math.round(val * 100)}%</label><input type="range" min="0" max="1" step="0.01" value="${val}"/>`;
        row.querySelector('input').addEventListener('input', (e) => {
          c.props.pos = +e.target.value; row.querySelector('label').textContent = propLabel(key) + ': ' + Math.round(c.props.pos * 100) + '%';
          resimIfRunning(); render();
        });
      } else if (key === 'state') {
        row.innerHTML = `<div class="toggle"><input type="checkbox" ${val ? 'checked' : ''}/> <label>${propLabel('state_label')} (${val ? '1' : '0'})</label></div>`;
        row.querySelector('input').addEventListener('change', (e) => { c.props.state = e.target.checked ? 1 : 0; resimIfRunning(); render(); renderProps(); });
      } else {
        const unit = tt.unit && (key === 'R' || key === 'V' || key === 'I') ? ' (' + tt.unit + ')' : '';
        row.innerHTML = `<label>${propLabel(key)}${unit}</label><input type="number" step="any" value="${val}"/>`;
        row.querySelector('input').addEventListener('change', (e) => { c.props[key] = +e.target.value; resimIfRunning(); render(); });
      }
      body.appendChild(row);
    }

    if (state.running) {
      const ro = document.createElement('div'); ro.className = 'readout'; ro.innerHTML = readoutHtml(c); body.appendChild(ro);
    }
    appendRotDel(body);
  }

  function appendRotDel(body) {
    const btns = document.createElement('div');
    btns.style.cssText = 'margin-top:12px;display:flex;gap:6px';
    btns.innerHTML = `<button id="pRot">${t('ui.rotate')}</button><button id="pDel">${t('ui.delete')}</button>`;
    body.appendChild(btns);
    $('#pRot').onclick = rotateSelected;
    $('#pDel').onclick = () => { deleteComponent(state.selected); updateDock(); resimIfRunning(); renderProps(); render(); };
  }

  // ---- signal generator props (16-bit pattern editor) ----
  const toHex = (v) => '0x' + ((v | 0) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

  function buildGeneratorProps(c, body) {
    if (!Array.isArray(c.props.patterns)) c.props.patterns = [0];

    // mode
    const modeRow = document.createElement('div'); modeRow.className = 'prop-row';
    modeRow.innerHTML = `<label>${t('gen.mode')}</label>
      <select id="genMode">
        <option value="burst">${t('gen.burst')}</option>
        <option value="cycle">${t('gen.cycle')}</option>
        <option value="step">${t('gen.step')}</option>
      </select>`;
    body.appendChild(modeRow);
    const sel = modeRow.querySelector('#genMode'); sel.value = c.props.mode || 'cycle';
    sel.onchange = () => { c.props.mode = sel.value; renderProps(); resimIfRunning(); };

    // frequency (burst/cycle)
    if ((c.props.mode || 'cycle') !== 'step') {
      const fr = document.createElement('div'); fr.className = 'prop-row';
      fr.innerHTML = `<label>${t('gen.freq')}</label><input type="number" id="genFreq" min="0.05" step="0.05" value="${c.props.freq || 2}"/>`;
      body.appendChild(fr);
      fr.querySelector('#genFreq').onchange = (e) => { c.props.freq = Math.max(0.05, +e.target.value); };
      const rb = document.createElement('button'); rb.textContent = t('gen.restart'); rb.style.marginBottom = '10px';
      rb.onclick = () => { if (state.running) { stopClock(); resetInstruments(); startClock(); } };
      body.appendChild(rb);
    } else {
      const sb = document.createElement('button'); sb.textContent = t('gen.stepBtn'); sb.className = 'primary'; sb.style.marginBottom = '10px';
      sb.onclick = () => {
        const n = (c.props.patterns || []).length || 1;
        c._idx = ((c._idx || 0) + 1) % n;
        if (state.running) { simulateOnce(); render(); }
        renderPatternTable(); updateCurLine();
      };
      body.appendChild(sb);
    }

    // current row + hex
    const cur = document.createElement('div'); cur.className = 'readout'; cur.id = 'genCur';
    body.appendChild(cur);
    function updateCurLine() {
      const pats = c.props.patterns || [0];
      const v = (pats[c._idx || 0] | 0) & 0xFFFF;
      $('#genCur').innerHTML = `${t('gen.current')}: <b>#${(c._idx || 0) + 1}/${pats.length}</b> &nbsp; ${t('gen.hex')}: <b>${toHex(v)}</b><br>
        <span style="font-family:monospace;letter-spacing:1px">${v.toString(2).padStart(16, '0')}</span>`;
    }

    // patterns table
    const ph = document.createElement('div'); ph.className = 'cat'; ph.textContent = t('gen.patterns'); ph.style.marginLeft = '0';
    body.appendChild(ph);
    const tableWrap = document.createElement('div'); tableWrap.id = 'genTable'; tableWrap.className = 'gen-table';
    body.appendChild(tableWrap);

    function renderPatternTable() {
      const wrap = $('#genTable'); if (!wrap) return; wrap.innerHTML = '';
      c.props.patterns.forEach((val, ri) => {
        const row = document.createElement('div'); row.className = 'gen-row' + (ri === (c._idx || 0) ? ' active' : '');
        const idxEl = document.createElement('span'); idxEl.className = 'gen-idx'; idxEl.textContent = (ri + 1);
        row.appendChild(idxEl);
        const bits = document.createElement('div'); bits.className = 'gen-bits';
        for (let b = NCH - 1; b >= 0; b--) {
          const on = (val >> b) & 1;
          const cell = document.createElement('span');
          cell.className = 'bit' + (on ? ' on' : '') + (b % 4 === 0 ? ' nib' : '');
          cell.title = 'Q' + b;
          cell.onclick = () => {
            c.props.patterns[ri] ^= (1 << b);
            renderPatternTable(); updateCurLine();
            if (state.running && !clock.raf) { simulateOnce(); render(); }
          };
          bits.appendChild(cell);
        }
        row.appendChild(bits);
        const hex = document.createElement('input'); hex.type = 'text'; hex.className = 'gen-hex'; hex.value = toHex(val).slice(2);
        hex.onchange = () => {
          const n = parseInt(hex.value.replace(/[^0-9a-fA-F]/g, ''), 16);
          c.props.patterns[ri] = isNaN(n) ? 0 : (n & 0xFFFF);
          renderPatternTable(); updateCurLine();
        };
        row.appendChild(hex);
        const del = document.createElement('button'); del.className = 'gen-del'; del.textContent = '×';
        del.onclick = () => { c.props.patterns.splice(ri, 1); if (!c.props.patterns.length) c.props.patterns = [0]; renderPatternTable(); updateCurLine(); };
        row.appendChild(del);
        wrap.appendChild(row);
      });
    }
    renderPatternTable(); updateCurLine();

    // add / clear
    const ctrl = document.createElement('div'); ctrl.style.cssText = 'display:flex;gap:6px;margin:8px 0';
    ctrl.innerHTML = `<button id="genAdd">${t('gen.addRow')}</button><button id="genClr">${t('gen.clearRows')}</button>`;
    body.appendChild(ctrl);
    ctrl.querySelector('#genAdd').onclick = () => { c.props.patterns.push(0); renderPatternTable(); updateCurLine(); };
    ctrl.querySelector('#genClr').onclick = () => { c.props.patterns = [0]; c._idx = 0; renderPatternTable(); updateCurLine(); };

    // bulk import
    const imp = document.createElement('div'); imp.className = 'prop-row';
    imp.innerHTML = `<label>${t('gen.import')}</label>
      <textarea id="genImp" rows="4" style="width:100%;font-family:monospace;font-size:11px"></textarea>
      <button id="genImpBtn" style="margin-top:6px">${t('gen.importBtn')}</button>`;
    body.appendChild(imp);
    imp.querySelector('#genImpBtn').onclick = () => {
      const lines = imp.querySelector('#genImp').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const out = [];
      for (const ln of lines) {
        let v;
        if (/^[01]{1,16}$/.test(ln)) v = parseInt(ln, 2);          // pure 16-bit binary
        else v = parseInt(ln.replace(/^0[xX]/, ''), 16);            // hex
        if (!isNaN(v)) out.push(v & 0xFFFF);
      }
      if (out.length) { c.props.patterns = out; c._idx = 0; renderPatternTable(); updateCurLine(); }
    };
  }

  function buildAnalyzerProps(c, body) {
    const win = document.createElement('div'); win.className = 'prop-row';
    win.innerHTML = `<label>${t('la.window')}</label><input type="number" min="1" max="60" step="1" value="${c.props.window || 8}"/>`;
    body.appendChild(win);
    win.querySelector('input').onchange = (e) => {
      c.props.window = Math.max(1, +e.target.value || 8);
      $('#laWindow').value = c.props.window; drawAnalyzers();
    };
    const note = document.createElement('p'); note.className = 'muted'; note.style.fontSize = '12px';
    note.textContent = t('la.nodata'); body.appendChild(note);
    if (state.running && c._levels) {
      const ro = document.createElement('div'); ro.className = 'readout';
      let h = '';
      for (let i = NCH - 1; i >= 0; i--) h += `D${i}:<b style="color:${c._levels[i] ? '#39d353' : '#6e7681'}">${c._levels[i] ? 1 : 0}</b> `;
      ro.innerHTML = h; body.appendChild(ro);
    }
  }

  function readoutHtml(c) {
    const tt = TYPES[c.type];
    const v = (n) => c._nodes ? state.sim.nodeV[c._nodes[n]] : null;
    let h = '';
    if (tt.pins.length === 2) h += `${t('prop.voltage_on_elem')}: <b>${fmt(v(0) - v(1), 'V')}</b><br>`;
    if (c._I !== undefined) h += `${t('prop.current')}: <b>${fmt(c._I, 'A')}</b><br>`;
    if (c._srcI !== undefined) h += `${t('prop.src_current')}: <b>${fmt(c._srcI, 'A')}</b><br>`;
    if (c._reading !== undefined) h += `${t('prop.meter_reading')}: <b>${fmt(c._reading, c.type === 'ammeter' ? 'A' : 'V')}</b><br>`;
    if (c._out !== undefined) h += `${t('prop.output')}: <b>${c._out}</b><br>`;
    if (c._lvl !== undefined) h += `${t('prop.level')}: <b>${c._lvl}</b><br>`;
    if (c._on !== undefined && tt.cat === 'Indicators') h += `${t('prop.status')}: <b>${c._on ? t('prop.on') : t('prop.off')}</b><br>`;
    if (tt.pins.length === 1) { const nv = v(0); if (nv != null) h += `${t('prop.node_potential')}: <b>${fmt(nv, 'V')}</b><br>`; }
    return h || t('prop.no_data');
  }

  function propLabel(k) { const s = I18n.t('prop.' + k); return s === 'prop.' + k ? k : s; }

  // ===================================================================
  // TOOLBAR
  // ===================================================================
  $('#btnRun').onclick = run;
  $('#btnStop').onclick = stop;
  $('#btnRotate').onclick = rotateSelected;
  $('#btnDelete').onclick = () => { if (state.selected != null) { deleteComponent(state.selected); updateDock(); resimIfRunning(); renderProps(); render(); } };
  $('#btnClear').onclick = () => {
    if (!confirm(t('ui.confirmClear'))) return;
    state.components = []; state.wires = []; state.selected = null; state.idc = 1;
    if (state.running) stop(); else render();
    updateDock(); renderProps(); autosave();
  };
  $('#btnSave').onclick = () => {
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'circuit.json'; a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#btnLoad').onclick = () => $('#fileInput').click();
  $('#fileInput').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { try { deserialize(JSON.parse(rd.result)); } catch (err) { alert(t('ui.fileError', { msg: err.message })); } };
    rd.readAsText(f); e.target.value = '';
  };

  // language
  $('#langSel').value = I18n.lang;
  $('#langSel').onchange = (e) => I18n.set(e.target.value);
  I18n.onChange(() => { buildPalette(); renderProps(); render(); statusFromSim(); });

  // analyzer dock controls
  $('#laClose').onclick = () => $('#ladock').classList.add('hidden');
  $('#laClear').onclick = () => { const a = currentAnalyzer(); if (a) { a._samples = []; drawAnalyzers(); } };
  $('#laWindow').onchange = (e) => { const a = currentAnalyzer(); if (a) { a.props.window = Math.max(1, +e.target.value || 8); drawAnalyzers(); renderProps(); } };

  function serialize() {
    return {
      components: state.components.map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y, rot: c.rot, props: c.props })),
      wires: state.wires.map(w => ({ a: w.a, b: w.b }))
    };
  }
  function deserialize(data) {
    if (state.running) stop();
    state.components = (data.components || []).map(c => ({ ...c, rot: c.rot || 0 }));
    state.wires = data.wires || [];
    state.idc = state.components.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    state.selected = null;
    render(); renderProps(); autosave();
  }

  function autosave() { try { localStorage.setItem('smartoks-circuit', JSON.stringify(serialize())); } catch (e) {} }
  function loadAutosave() { try { const s = localStorage.getItem('smartoks-circuit'); if (s) deserialize(JSON.parse(s)); } catch (e) {} }

  function setStatus(s) { $('#status').textContent = s; }

  // ===================================================================
  // INIT
  // ===================================================================
  I18n.applyStatic();
  buildPalette();
  resize();
  loadAutosave();
  if (state.components.length === 0) demo();
  render(); renderProps();

  function demo() {
    const bat = addComponent('dc-source', 140, 200); bat.props.V = 9;
    const sw = addComponent('switch', 260, 140); sw.props.closed = true;
    const lamp = addComponent('lamp', 400, 200);
    const gnd = addComponent('ground', 140, 320);
    state.wires.push({ a: { comp: bat.id, pin: 0 }, b: { comp: sw.id, pin: 0 } });
    state.wires.push({ a: { comp: sw.id, pin: 1 }, b: { comp: lamp.id, pin: 0 } });
    state.wires.push({ a: { comp: lamp.id, pin: 1 }, b: { comp: gnd.id, pin: 0 } });
    state.wires.push({ a: { comp: bat.id, pin: 1 }, b: { comp: gnd.id, pin: 0 } });
    setStatus(t('ui.demoLoaded'));
  }
})();
