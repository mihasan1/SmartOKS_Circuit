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

  // ---------- theme (canvas colors per theme) ----------
  const THEMES = {
    light: { canvasBg: '#f7f8fb', grid: '#dfe4ec', stroke: '#46506a', label: '#95a0b3',
             wire: '#aab2c2', sel: '#3b6ef5', pin: '#f0883e', pinHover: '#22c55e',
             laBg: '#ffffff', laGrid: '#eceff4', laWave: '#22c55e', laLabel: '#95a0b3', laMuted: '#aab2c2' },
    dark:  { canvasBg: '#14181f', grid: '#232a36', stroke: '#cdd9e5', label: '#8b95a5',
             wire: '#6e7681', sel: '#3b6ef5', pin: '#f0883e', pinHover: '#39d353',
             laBg: '#14181f', laGrid: '#232a36', laWave: '#39d353', laLabel: '#8b95a5', laMuted: '#566072' }
  };
  let themeName = localStorage.getItem('smartoks-theme') || 'light';
  if (!THEMES[themeName]) themeName = 'light';
  let TC = THEMES[themeName];

  // ---------- state ----------
  const state = {
    components: [], wires: [], selected: null, placing: null,
    wiring: null, drag: null, running: false, sim: null, idc: 1,
    mouse: { x: 0, y: 0 }
  };

  // ---------- history / clipboard ----------
  const history = { undo: [], redo: [] };
  let lastSnapshot = '';     // JSON of the last committed state
  let clipboard = null;      // { type, rot, props }
  let spaceDown = false;     // hold Space to pan with left mouse

  const $ = (s) => document.querySelector(s);
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');

  // ---------- camera (infinite pan/zoom) ----------
  // screen = world * scale + offset
  const view = { scale: 1, x: 0, y: 0 };
  const MIN_SCALE = 0.2, MAX_SCALE = 4;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function screenToWorld(sx, sy) { return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale }; }
  function getScreen(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

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

  // ---------- hit testing (mx,my in WORLD coords) ----------
  function pinAt(mx, my) {
    let best = null, bd = 10 / view.scale;
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
    const pad = 4 / view.scale;
    for (let k = state.components.length - 1; k >= 0; k--) {
      const c = state.components[k]; const tt = TYPES[c.type];
      const d = rot(mx - c.x, my - c.y, -c.rot);
      if (Math.abs(d.x) <= tt.w / 2 + pad && Math.abs(d.y) <= tt.h / 2 + pad) return c;
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
  function resimIfRunning() { if (state.running) { simulateOnce(); render(); } else render(); commit(); }

  // ===================================================================
  // HISTORY (undo/redo) + CLIPBOARD
  // ===================================================================
  function snapshotStr() { return JSON.stringify(serialize()); }
  function resetHistory() { history.undo.length = 0; history.redo.length = 0; lastSnapshot = snapshotStr(); }
  function commit() {
    const snap = snapshotStr();
    if (snap === lastSnapshot) { autosave(); return; }   // nothing structural changed
    history.undo.push(lastSnapshot);
    if (history.undo.length > 120) history.undo.shift();
    history.redo.length = 0;
    lastSnapshot = snap;
    autosave();
  }
  function applySnapshot(jsonStr) {
    const data = JSON.parse(jsonStr);
    state.components = (data.components || []).map(c => ({ ...c, rot: c.rot || 0 }));
    state.wires = data.wires || [];
    state.idc = state.components.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    if (state.selected != null && !compById(state.selected)) state.selected = null;
    lastSnapshot = jsonStr;
    updateDock();
    if (state.running) { stopClock(); resetInstruments(); if (needsClock()) startClock(); else simulateOnce(); }
    render(); renderProps(); autosave();
  }
  function undo() {
    if (!history.undo.length) { setStatus(t('ui.nothingUndo')); return; }
    history.redo.push(lastSnapshot);
    applySnapshot(history.undo.pop());
    setStatus(t('ui.undone'));
  }
  function redo() {
    if (!history.redo.length) { setStatus(t('ui.nothingRedo')); return; }
    history.undo.push(lastSnapshot);
    applySnapshot(history.redo.pop());
    setStatus(t('ui.redone'));
  }

  function copySel() {
    if (state.selected == null) return;
    const c = compById(state.selected);
    clipboard = { type: c.type, rot: c.rot, props: JSON.parse(JSON.stringify(c.props)) };
    setStatus(t('ui.copied', { name: I18n.comp(c.type) }));
  }
  function placeClone(clone, x, y) {
    const c = addComponent(clone.type, x, y);
    c.rot = clone.rot || 0;
    c.props = JSON.parse(JSON.stringify(clone.props));
    state.selected = c.id;
    if (state.running && TYPES[c.type].instrument) { stopClock(); resetInstruments(); startClock(); }
    updateDock(); resimIfRunning(); renderProps(); render();
    return c;
  }
  function paste() {
    if (!clipboard) return;
    const at = state.mouse && isFinite(state.mouse.x) ? state.mouse : { x: 200, y: 200 };
    placeClone(clipboard, at.x, at.y);
    setStatus(t('ui.pasted', { name: I18n.comp(clipboard.type) }));
  }
  function cutSel() {
    if (state.selected == null) return;
    copySel();
    deleteComponent(state.selected);
    updateDock(); resimIfRunning(); renderProps(); render();
  }
  function duplicateSel() {
    if (state.selected == null) return;
    const c = compById(state.selected);
    placeClone({ type: c.type, rot: c.rot, props: c.props }, c.x + GRID, c.y + GRID);
  }

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
    const cv = $('#laCanvas');
    const r = cv.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  function drawAnalyzers() {
    const dock = $('#ladock'); if (dock.classList.contains('hidden')) return;
    const cv = $('#laCanvas'); const x = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H); x.fillStyle = TC.laBg; x.fillRect(0, 0, W, H);
    const c = currentAnalyzer();
    if (!c || !c._samples || c._samples.length < 2) {
      x.fillStyle = TC.laMuted; x.font = '12px Inter, monospace'; x.textAlign = 'left';
      x.fillText(t('la.nodata'), 12, 22); return;
    }
    const win = Math.max(1, +c.props.window || 8);
    const tEnd = clock.t, tStart = tEnd - win;
    const labelW = 44, plotW = W - labelW - 8, rows = NCH, rowH = (H - 8) / rows;
    const sx = (tt) => labelW + ((tt - tStart) / win) * plotW;
    for (let ch = 0; ch < rows; ch++) {
      const y0 = 4 + ch * rowH, hi = y0 + rowH * 0.2, lo = y0 + rowH * 0.8;
      x.fillStyle = TC.laLabel; x.font = '9px monospace'; x.textAlign = 'left';
      x.fillText('D' + ch, 4, y0 + rowH * 0.64);
      x.strokeStyle = TC.laGrid;
      x.beginPath(); x.moveTo(labelW, y0 + rowH); x.lineTo(W, y0 + rowH); x.stroke();
      x.strokeStyle = TC.laWave; x.lineWidth = 1.4; x.beginPath();
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = TC.canvasBg; ctx.fillRect(0, 0, W, H);

    // apply camera
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    // infinite grid (only when dots are far enough apart on screen)
    if (GRID * view.scale >= 7) {
      const tl = screenToWorld(0, 0), br = screenToWorld(W, H);
      const x0 = Math.floor(tl.x / GRID) * GRID, y0 = Math.floor(tl.y / GRID) * GRID;
      const ds = 1 / view.scale;
      ctx.fillStyle = TC.grid;
      for (let x = x0; x < br.x; x += GRID)
        for (let y = y0; y < br.y; y += GRID) ctx.fillRect(x, y, ds, ds);
    }

    // wires
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (const w of state.wires) {
      const ca = compById(w.a.comp), cb = compById(w.b.comp);
      if (!ca || !cb) continue;
      const a = absPin(ca, w.a.pin), b = absPin(cb, w.b.pin);
      let col = TC.wire;
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
      ctx.strokeStyle = TC.stroke; ctx.fillStyle = TC.stroke; ctx.lineWidth = 2; ctx.font = '11px monospace';
      ctx.textAlign = 'start';
      tt.draw(ctx, c);
      ctx.restore();

      if (state.selected === c.id) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot * Math.PI / 180);
        ctx.strokeStyle = TC.sel; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
        ctx.strokeRect(-tt.w / 2 - 3, -tt.h / 2 - 3, tt.w + 6, tt.h + 6);
        ctx.setLineDash([]); ctx.restore();
      }

      if (!tt.instrument) {
        ctx.fillStyle = TC.label; ctx.font = '10px monospace'; ctx.textAlign = 'center';
        const lbl = labelFor(c);
        if (lbl) ctx.fillText(lbl, c.x, c.y + tt.h / 2 + 13);
        ctx.textAlign = 'start';
      }
    }

    const pr = 3 / view.scale, prh = 4.5 / view.scale;
    for (const c of state.components) {
      TYPES[c.type].pins.forEach((_, i) => {
        const p = absPin(c, i);
        const hov = nearPin(p, state.mouse);
        ctx.fillStyle = hov ? TC.pinHover : TC.pin;
        ctx.beginPath(); ctx.arc(p.x, p.y, hov ? prh : pr, 0, 7); ctx.fill();
      });
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const zl = document.getElementById('zoomLabel');
    if (zl) zl.textContent = Math.round(view.scale * 100) + '%';
  }
  function nearPin(p, m) { return Math.hypot(p.x - m.x, p.y - m.y) < 8 / view.scale; }

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
  function getMouse(e) { const s = getScreen(e); return screenToWorld(s.x, s.y); }

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {   // middle / Space+left → pan
      e.preventDefault();
      const s = getScreen(e);
      state.pan = { sx: s.x, sy: s.y, ox: view.x, oy: view.y };
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;
    const m = getMouse(e); state.mouse = m;
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

  window.addEventListener('mousemove', (e) => {
    if (state.pan) {
      const s = getScreen(e);
      view.x = state.pan.ox + (s.x - state.pan.sx);
      view.y = state.pan.oy + (s.y - state.pan.sy);
      render(); return;
    }
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
    if (state.pan) { state.pan = null; canvas.style.cursor = spaceDown ? 'grab' : ''; return; }
    if (state.drag) { const moved = state.drag.moved; state.drag = null; if (moved) commit(); }
  });

  // wheel = zoom around the cursor
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const s = getScreen(e); const before = screenToWorld(s.x, s.y);
    const factor = Math.exp(-e.deltaY * 0.0015);
    view.scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
    view.x = s.x - before.x * view.scale;
    view.y = s.y - before.y * view.scale;
    render();
  }, { passive: false });

  // drag-and-drop placement from the palette
  canvas.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const key = e.dataTransfer.getData('text/plain');
    if (!key || !TYPES[key]) return;
    const m = getMouse(e);
    const c = addComponent(key, m.x, m.y); state.selected = c.id;
    if (state.running && TYPES[c.type].instrument) { stopClock(); resetInstruments(); startClock(); }
    updateDock(); resimIfRunning(); renderProps(); render();
    setStatus(t('ui.ready'));
  });

  // zoom controls
  function zoomBy(factor) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const before = screenToWorld(cx, cy);
    view.scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
    view.x = cx - before.x * view.scale; view.y = cy - before.y * view.scale;
    render();
  }
  function fitView() {
    const W = canvas.width, H = canvas.height;
    if (!state.components.length) { view.scale = 1; view.x = W / 2; view.y = H / 2; render(); return; }
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const c of state.components) {
      const tt = TYPES[c.type]; const hw = Math.max(tt.w, tt.h) / 2 + 24;
      minx = Math.min(minx, c.x - hw); miny = Math.min(miny, c.y - hw);
      maxx = Math.max(maxx, c.x + hw); maxy = Math.max(maxy, c.y + hw);
    }
    const sc = clamp(Math.min(W / (maxx - minx), H / (maxy - miny)) * 0.92, MIN_SCALE, 1);
    view.scale = sc;
    view.x = W / 2 - (minx + maxx) / 2 * sc;
    view.y = H / 2 - (miny + maxy) / 2 * sc;
    render();
  }
  $('#zoomIn').onclick = () => zoomBy(1.2);
  $('#zoomOut').onclick = () => zoomBy(1 / 1.2);
  $('#zoomReset').onclick = fitView;

  canvas.addEventListener('dblclick', (e) => {
    const m = getMouse(e); const c = compAt(m.x, m.y); if (!c) return;
    const tt = TYPES[c.type];
    if (tt.toggle) { c.props.closed = !c.props.closed; resimIfRunning(); renderProps(); }
    else if (tt.toggleLogic) { c.props.state = c.props.state ? 0 : 1; resimIfRunning(); renderProps(); }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpOpen()) { closeHelp(); return; }
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      else if (k === 'c') { e.preventDefault(); copySel(); }
      else if (k === 'x') { e.preventDefault(); cutSel(); }
      else if (k === 'v') { e.preventDefault(); paste(); }
      else if (k === 'd') { e.preventDefault(); duplicateSel(); }
      else if (k === 's') { e.preventDefault(); downloadCircuit(); }
      else if (k === 'a') { e.preventDefault(); /* reserved */ }
      return;
    }

    if (e.key === ' ') { if (!spaceDown) { spaceDown = true; canvas.style.cursor = 'grab'; } e.preventDefault(); }
    else if (e.key === 'Escape') { state.wiring = null; render(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected != null) {
      deleteComponent(state.selected); updateDock(); resimIfRunning(); renderProps(); render();
    } else if (e.key === 'r' || e.key === 'R') rotateSelected();
    else if (e.key === '0') fitView();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') { spaceDown = false; if (!state.pan) canvas.style.cursor = ''; }
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
        item.draggable = true;
        item.title = I18n.comp(key);
        const mini = document.createElement('canvas'); mini.width = 46; mini.height = 34;
        drawMini(mini, tt);
        const span = document.createElement('span'); span.textContent = I18n.comp(key);
        item.appendChild(mini); item.appendChild(span);
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', key);
          e.dataTransfer.effectAllowed = 'copy';
          item.classList.add('dragging');
          try { e.dataTransfer.setDragImage(mini, 23, 17); } catch (_) {}
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
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
    c.strokeStyle = TC.stroke; c.fillStyle = TC.stroke; c.lineWidth = 2; c.font = '11px monospace';
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
        const inp = row.querySelector('input');
        inp.addEventListener('input', (e) => {           // live (no history entry per tick)
          c.props.pos = +e.target.value; row.querySelector('label').textContent = propLabel(key) + ': ' + Math.round(c.props.pos * 100) + '%';
          if (state.running) { simulateOnce(); } render();
        });
        inp.addEventListener('change', () => commit());   // one history entry when released
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
    btns.innerHTML = `<button id="pRot" class="btn">${window.iconHTML('rotate')}<span>${t('ui.rotate')}</span></button>`
      + `<button id="pDel" class="btn">${window.iconHTML('trash')}<span>${t('ui.delete')}</span></button>`;
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
      fr.querySelector('#genFreq').onchange = (e) => { c.props.freq = Math.max(0.05, +e.target.value); commit(); };
      const rb = document.createElement('button'); rb.className = 'btn'; rb.style.marginBottom = '10px';
      rb.innerHTML = window.iconHTML('restart') + `<span>${t('gen.restart')}</span>`;
      rb.onclick = () => { if (state.running) { stopClock(); resetInstruments(); startClock(); } };
      body.appendChild(rb);
    } else {
      const sb = document.createElement('button'); sb.className = 'btn btn-primary'; sb.style.marginBottom = '10px';
      sb.innerHTML = window.iconHTML('step') + `<span>${t('gen.stepBtn')}</span>`;
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
            commit();
          };
          bits.appendChild(cell);
        }
        row.appendChild(bits);
        const hex = document.createElement('input'); hex.type = 'text'; hex.className = 'gen-hex'; hex.value = toHex(val).slice(2);
        hex.onchange = () => {
          const n = parseInt(hex.value.replace(/[^0-9a-fA-F]/g, ''), 16);
          c.props.patterns[ri] = isNaN(n) ? 0 : (n & 0xFFFF);
          renderPatternTable(); updateCurLine(); commit();
        };
        row.appendChild(hex);
        const del = document.createElement('button'); del.className = 'gen-del'; del.innerHTML = window.iconHTML('close');
        del.onclick = () => { c.props.patterns.splice(ri, 1); if (!c.props.patterns.length) c.props.patterns = [0]; renderPatternTable(); updateCurLine(); commit(); };
        row.appendChild(del);
        wrap.appendChild(row);
      });
    }
    renderPatternTable(); updateCurLine();

    // add / clear
    const ctrl = document.createElement('div'); ctrl.style.cssText = 'display:flex;gap:6px;margin:8px 0';
    ctrl.innerHTML = `<button id="genAdd" class="btn">${t('gen.addRow')}</button><button id="genClr" class="btn">${t('gen.clearRows')}</button>`;
    body.appendChild(ctrl);
    ctrl.querySelector('#genAdd').onclick = () => { c.props.patterns.push(0); renderPatternTable(); updateCurLine(); commit(); };
    ctrl.querySelector('#genClr').onclick = () => { c.props.patterns = [0]; c._idx = 0; renderPatternTable(); updateCurLine(); commit(); };

    // bulk import
    const imp = document.createElement('div'); imp.className = 'prop-row';
    imp.innerHTML = `<label>${t('gen.import')}</label>
      <textarea id="genImp" rows="4" style="width:100%;font-family:monospace;font-size:11px"></textarea>
      <button id="genImpBtn" class="btn" style="margin-top:6px">${t('gen.importBtn')}</button>`;
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
      if (out.length) { c.props.patterns = out; c._idx = 0; renderPatternTable(); updateCurLine(); commit(); }
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
      for (let i = NCH - 1; i >= 0; i--) h += `D${i}:<b style="color:${c._levels[i] ? 'var(--green)' : 'var(--muted)'}">${c._levels[i] ? 1 : 0}</b> `;
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
    updateDock(); renderProps(); commit();
  };
  function downloadCircuit() {
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'circuit.json'; a.click();
    URL.revokeObjectURL(a.href);
  }
  $('#btnSave').onclick = downloadCircuit;
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
  I18n.onChange(() => { buildPalette(); renderProps(); render(); statusFromSim(); refreshTitles(); });

  // theme
  function applyTheme(name) {
    themeName = THEMES[name] ? name : 'light';
    TC = THEMES[themeName];
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('smartoks-theme', themeName);
    buildPalette();          // redraw mini previews with new stroke color
    render(); drawAnalyzers();
  }
  $('#themeToggle').onclick = () => applyTheme(themeName === 'light' ? 'dark' : 'light');

  // help modal
  function openHelp() { $('#helpBody').innerHTML = t('help.html'); $('#helpModal').classList.remove('hidden'); }
  function closeHelp() { $('#helpModal').classList.add('hidden'); }
  function helpOpen() { return !$('#helpModal').classList.contains('hidden'); }
  $('#btnHelp').onclick = openHelp;
  $('#helpClose').onclick = closeHelp;
  $('#helpModal').querySelector('.modal-backdrop').onclick = closeHelp;

  // icon-button tooltips (localized)
  function refreshTitles() {
    $('#btnRotate').title = t('ui.tip_rotate');
    $('#btnDelete').title = t('ui.tip_delete');
    $('#btnSave').title = t('ui.tip_save');
    $('#btnLoad').title = t('ui.tip_load');
    $('#btnClear').title = t('ui.tip_clear');
    $('#btnHelp').title = t('ui.tip_help');
    $('#themeToggle').title = t('ui.theme');
    document.querySelector('#helpModal h2').textContent = t('help.title');
    if (helpOpen()) $('#helpBody').innerHTML = t('help.html');
  }

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
    render(); renderProps(); resetHistory(); autosave();
  }

  function autosave() { try { localStorage.setItem('smartoks-circuit', JSON.stringify(serialize())); } catch (e) {} }
  function loadAutosave() { try { const s = localStorage.getItem('smartoks-circuit'); if (s) deserialize(JSON.parse(s)); } catch (e) {} }

  function setStatus(s) { $('#status').textContent = s; }

  // ===================================================================
  // INIT
  // ===================================================================
  I18n.applyStatic();
  document.documentElement.setAttribute('data-theme', themeName);
  refreshTitles();
  buildPalette();
  resize();
  loadAutosave();
  if (state.components.length === 0) demo();
  render(); renderProps();
  resetHistory();
  fitView();

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
