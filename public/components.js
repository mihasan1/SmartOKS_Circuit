/* =====================================================================
 * components.js — component registry
 *   geometry (symbol drawing + pins) + electrical model (primitive emit)
 * ===================================================================== */
(function (global) {
  'use strict';

  const HIGH = 5, LOW = 0, THRESH = 2.5;

  const logic = (v) => (v >= THRESH ? 1 : 0);

  // ---- small canvas helpers -------------------------------------------
  function lead(ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  // Each type: { name, cat, w, h, pins:[{x,y,name}], props, draw(ctx,comp,r),
  //   model:'analog'|'gate'|'dsource'|'ground'|'probe',
  //   emit(comp,n), evalLogic(comp,nv,n), readout(comp,nv,n) }
  const T = {};

  /* ---------------------------------------------------------------- SOURCES */
  T['dc-source'] = {
    name: 'DC Voltage', cat: 'Sources', w: 60, h: 40,
    pins: [{ x: -30, y: 0, name: '+' }, { x: 30, y: 0, name: '-' }],
    props: { V: 9 }, unit: 'V', model: 'analog',
    emit: (c, n) => [{ kind: 'V', nodes: [n[0], n[1]], value: +c.props.V }],
    draw(ctx, c) {
      lead(ctx, -30, 0, -12, 0); lead(ctx, 12, 0, 30, 0);
      // long + short plates
      ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(-12, 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2, -7); ctx.lineTo(-2, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -14); ctx.lineTo(2, 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -7); ctx.lineTo(12, 7); ctx.stroke();
      ctx.fillText('+', -20, -10);
    }
  };

  T['battery'] = {
    name: 'Battery', cat: 'Sources', w: 60, h: 40,
    pins: [{ x: -30, y: 0, name: '+' }, { x: 30, y: 0, name: '-' }],
    props: { V: 1.5 }, unit: 'V', model: 'analog',
    emit: (c, n) => [{ kind: 'V', nodes: [n[0], n[1]], value: +c.props.V }],
    draw(ctx) {
      lead(ctx, -30, 0, -18, 0); lead(ctx, 18, 0, 30, 0);
      for (let i = 0; i < 2; i++) {
        const x = -10 + i * 16;
        ctx.beginPath(); ctx.moveTo(x, -14); ctx.lineTo(x, 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 8, -7); ctx.lineTo(x + 8, 7); ctx.stroke();
      }
    }
  };

  T['current-source'] = {
    name: 'Current Source', cat: 'Sources', w: 50, h: 50,
    pins: [{ x: 0, y: -30, name: '+' }, { x: 0, y: 30, name: '-' }],
    props: { I: 0.1 }, unit: 'A', model: 'analog',
    // current flows from + (top) to - (bottom) inside source
    emit: (c, n) => [{ kind: 'I', nodes: [n[1], n[0]], value: +c.props.I }],
    draw(ctx) {
      lead(ctx, 0, -30, 0, -18); lead(ctx, 0, 18, 0, 30);
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-4, -3); ctx.moveTo(0, -10); ctx.lineTo(4, -3); ctx.stroke();
    }
  };

  T['vcc'] = {
    name: '+5V Rail', cat: 'Sources', w: 30, h: 40,
    pins: [{ x: 0, y: 20, name: 'V' }],
    props: { V: 5 }, unit: 'V', model: 'analog',
    emit: (c, n) => [{ kind: 'V', nodes: [n[0], 0], value: +c.props.V }],
    draw(ctx, c) {
      lead(ctx, 0, 20, 0, 0);
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.stroke();
      ctx.fillText(c.props.V + 'V', -8, -12);
    }
  };

  T['ground'] = {
    name: 'Ground', cat: 'Sources', w: 30, h: 30,
    pins: [{ x: 0, y: -15, name: 'GND' }],
    props: {}, model: 'ground',
    emit: () => [],
    draw(ctx) {
      lead(ctx, 0, -15, 0, 0);
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(8, 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(4, 10); ctx.stroke();
    }
  };

  /* -------------------------------------------------------------- PASSIVE */
  T['resistor'] = {
    name: 'Resistor', cat: 'Passive', w: 60, h: 20,
    pins: [{ x: -30, y: 0 }, { x: 30, y: 0 }],
    props: { R: 1000 }, unit: 'Ω', model: 'analog',
    emit: (c, n) => [{ kind: 'R', nodes: [n[0], n[1]], value: +c.props.R }],
    readout(c, nv, n) { c._I = (nv[n[0]] - nv[n[1]]) / (+c.props.R || 1e-9); },
    draw(ctx) {
      lead(ctx, -30, 0, -18, 0); lead(ctx, 18, 0, 30, 0);
      ctx.beginPath(); ctx.moveTo(-18, 0);
      const pts = [-15, -9, -3, 3, 9, 15];
      pts.forEach((x, i) => ctx.lineTo(x, i % 2 ? 8 : -8));
      ctx.lineTo(18, 0); ctx.stroke();
    }
  };

  T['potentiometer'] = {
    name: 'Potentiometer', cat: 'Passive', w: 60, h: 30,
    pins: [{ x: -30, y: 0 }, { x: 30, y: 0 }],
    props: { R: 10000, pos: 0.5 }, unit: 'Ω', model: 'analog',
    // simple 2-terminal variable resistor: R_eff = R*pos
    emit: (c, n) => [{ kind: 'R', nodes: [n[0], n[1]], value: Math.max(1, (+c.props.R) * (+c.props.pos)) }],
    readout(c, nv, n) { c._I = (nv[n[0]] - nv[n[1]]) / Math.max(1, (+c.props.R) * (+c.props.pos)); },
    draw(ctx) {
      lead(ctx, -30, 0, -18, 0); lead(ctx, 18, 0, 30, 0);
      ctx.beginPath(); ctx.moveTo(-18, 0);
      [-15, -9, -3, 3, 9, 15].forEach((x, i) => ctx.lineTo(x, i % 2 ? 8 : -8));
      ctx.lineTo(18, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-3, -10); ctx.moveTo(0, -14); ctx.lineTo(3, -10); ctx.stroke();
    }
  };

  T['lamp'] = {
    name: 'Lamp', cat: 'Indicators', w: 40, h: 40,
    pins: [{ x: -30, y: 0 }, { x: 30, y: 0 }],
    props: { R: 100, rated: 6 }, unit: 'Ω', model: 'analog',
    emit: (c, n) => [{ kind: 'R', nodes: [n[0], n[1]], value: +c.props.R }],
    readout(c, nv, n) {
      const v = Math.abs(nv[n[0]] - nv[n[1]]);
      c._I = v / (+c.props.R || 1e-9);
      c._bright = Math.min(1, v / (+c.props.rated || 6));
      c._on = c._bright > 0.05;
    },
    draw(ctx, c) {
      lead(ctx, -30, 0, -14, 0); lead(ctx, 14, 0, 30, 0);
      if (c._on) {
        ctx.save();
        ctx.fillStyle = `rgba(255,210,60,${0.25 + 0.6 * (c._bright || 0)})`;
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10);
      ctx.moveTo(10, -10); ctx.lineTo(-10, 10); ctx.stroke();
    }
  };

  T['led'] = {
    name: 'LED', cat: 'Indicators', w: 40, h: 30,
    pins: [{ x: -30, y: 0, name: 'A' }, { x: 30, y: 0, name: 'K' }],
    props: { R: 220, Vf: 2 }, unit: 'Ω', model: 'analog',
    emit: (c, n) => [{ kind: 'R', nodes: [n[0], n[1]], value: +c.props.R }],
    readout(c, nv, n) {
      const vfwd = nv[n[0]] - nv[n[1]];
      c._I = vfwd / (+c.props.R || 1e-9);
      c._on = vfwd > 0.5 && c._I > 0.001;
      c._bright = Math.min(1, c._I / 0.02);
    },
    draw(ctx, c) {
      lead(ctx, -30, 0, -8, 0); lead(ctx, 8, 0, 30, 0);
      ctx.save();
      if (c._on) ctx.fillStyle = `rgba(255,60,60,${0.3 + 0.6 * (c._bright || 0)})`;
      else ctx.fillStyle = 'rgba(120,40,40,0.25)';
      ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-8, 10); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(8, 10); ctx.stroke();
      if (c._on) {
        ctx.beginPath(); ctx.moveTo(6, -14); ctx.lineTo(11, -19); ctx.moveTo(11, -14); ctx.lineTo(16, -19); ctx.stroke();
      }
    }
  };

  /* -------------------------------------------------------------- SWITCHES */
  T['switch'] = {
    name: 'Switch (SPST)', cat: 'Switches', w: 60, h: 30,
    pins: [{ x: -30, y: 0 }, { x: 30, y: 0 }],
    props: { closed: false }, model: 'analog', toggle: true,
    emit: (c, n) => [{ kind: 'R', nodes: [n[0], n[1]], value: c.props.closed ? 0.01 : 1e9 }],
    readout(c, nv, n) { c._I = (nv[n[0]] - nv[n[1]]) / (c.props.closed ? 0.01 : 1e9); },
    draw(ctx, c) {
      lead(ctx, -30, 0, -14, 0); lead(ctx, 14, 0, 30, 0);
      ctx.beginPath(); ctx.arc(-14, 0, 2.5, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(14, 0, 2.5, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, 0);
      if (c.props.closed) ctx.lineTo(14, 0); else ctx.lineTo(12, -12);
      ctx.stroke();
    }
  };

  T['pushbutton'] = {
    name: 'Push Button', cat: 'Switches', w: 60, h: 36,
    pins: [{ x: -30, y: 0 }, { x: 30, y: 0 }],
    props: { closed: false }, model: 'analog', toggle: true,
    emit: (c, n) => [{ kind: 'R', nodes: [n[0], n[1]], value: c.props.closed ? 0.01 : 1e9 }],
    readout(c, nv, n) { c._I = (nv[n[0]] - nv[n[1]]) / (c.props.closed ? 0.01 : 1e9); },
    draw(ctx, c) {
      lead(ctx, -30, 0, -14, 0); lead(ctx, 14, 0, 30, 0);
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-14, -6); ctx.moveTo(14, 0); ctx.lineTo(14, -6); ctx.stroke();
      const y = c.props.closed ? -6 : -10;
      ctx.beginPath(); ctx.moveTo(-16, y); ctx.lineTo(16, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(0, y - 6); ctx.stroke();
    }
  };

  /* ---------------------------------------------------------------- METERS */
  T['voltmeter'] = {
    name: 'Voltmeter', cat: 'Meters', w: 44, h: 44,
    pins: [{ x: -30, y: 0, name: '+' }, { x: 30, y: 0, name: '-' }],
    props: {}, model: 'analog',
    emit: (c, n) => [{ kind: 'R', nodes: [n[0], n[1]], value: 1e9 }],
    readout(c, nv, n) { c._reading = nv[n[0]] - nv[n[1]]; },
    draw(ctx, c) {
      lead(ctx, -30, 0, -16, 0); lead(ctx, 16, 0, 30, 0);
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.stroke();
      ctx.fillText('V', -4, 5);
    }
  };

  T['ammeter'] = {
    name: 'Ammeter', cat: 'Meters', w: 44, h: 44,
    pins: [{ x: -30, y: 0, name: '+' }, { x: 30, y: 0, name: '-' }],
    props: {}, model: 'analog',
    emit: (c, n) => [{ kind: 'R', nodes: [n[0], n[1]], value: 1e-3 }],
    readout(c, nv, n) { c._reading = (nv[n[0]] - nv[n[1]]) / 1e-3; },
    draw(ctx, c) {
      lead(ctx, -30, 0, -16, 0); lead(ctx, 16, 0, 30, 0);
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.stroke();
      ctx.fillText('A', -4, 5);
    }
  };

  /* ------------------------------------------------------------ DIGITAL IO */
  T['logic-toggle'] = {
    name: 'Logic Switch', cat: 'Digital', w: 40, h: 30,
    pins: [{ x: 30, y: 0, name: 'Q' }],
    props: { state: 0 }, model: 'analog', toggleLogic: true,
    emit: (c, n) => [{ kind: 'V', nodes: [n[0], 0], value: c.props.state ? HIGH : LOW }],
    readout(c) { c._on = !!c.props.state; },
    draw(ctx, c) {
      lead(ctx, 12, 0, 30, 0);
      ctx.strokeRect(-16, -12, 28, 24);
      ctx.fillText(c.props.state ? '1' : '0', -7, 5);
    }
  };

  T['logic-high'] = {
    name: 'Logic 1 (Vcc)', cat: 'Digital', w: 36, h: 26,
    pins: [{ x: 18, y: 0, name: 'Q' }],
    props: {}, model: 'analog',
    emit: (c, n) => [{ kind: 'V', nodes: [n[0], 0], value: HIGH }],
    draw(ctx) { lead(ctx, 4, 0, 18, 0); ctx.strokeRect(-14, -11, 18, 22); ctx.fillText('1', -8, 5); }
  };

  T['logic-low'] = {
    name: 'Logic 0 (GND)', cat: 'Digital', w: 36, h: 26,
    pins: [{ x: 18, y: 0, name: 'Q' }],
    props: {}, model: 'analog',
    emit: (c, n) => [{ kind: 'V', nodes: [n[0], 0], value: LOW }],
    draw(ctx) { lead(ctx, 4, 0, 18, 0); ctx.strokeRect(-14, -11, 18, 22); ctx.fillText('0', -8, 5); }
  };

  T['logic-probe'] = {
    name: 'Logic Probe', cat: 'Digital', w: 36, h: 30,
    pins: [{ x: -18, y: 0, name: 'D' }],
    props: {}, model: 'analog',
    emit: (c, n) => [{ kind: 'R', nodes: [n[0], 0], value: 1e9 }],
    readout(c, nv, n) { c._lvl = logic(nv[n[0]]); c._on = c._lvl === 1; },
    draw(ctx, c) {
      lead(ctx, -18, 0, -8, 0);
      ctx.save();
      ctx.fillStyle = c._on ? '#39d353' : '#243018';
      ctx.beginPath(); ctx.arc(2, 0, 11, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = c._on ? '#04210a' : '#5a6';
      ctx.fillText(c._lvl != null ? String(c._lvl) : '?', -2, 5);
    }
  };

  /* ------------------------------------------------------------ LOGIC GATES */
  function gateBody(ctx, label) {
    ctx.fillText(label, -ctx.measureText(label).width / 2, 4);
  }

  function makeGate(key, name, nIn, evalFn, shape) {
    const pins = [];
    if (nIn === 1) pins.push({ x: -30, y: 0, name: 'A' });
    else if (nIn === 2) { pins.push({ x: -30, y: -10, name: 'A' }); pins.push({ x: -30, y: 10, name: 'B' }); }
    pins.push({ x: 30, y: 0, name: 'Q' });
    T[key] = {
      name, cat: 'Logic Gates', w: 60, h: 40, pins,
      props: {}, model: 'gate', nIn,
      emit: (c, n) => [{ kind: 'V', nodes: [n[pins.length - 1], 0], value: c._out ? HIGH : LOW }],
      evalLogic(c, nv, n) {
        const ins = [];
        for (let i = 0; i < nIn; i++) ins.push(logic(nv[n[i]]));
        c._out = evalFn(ins) ? 1 : 0;
        return c._out;
      },
      readout(c) { c._on = !!c._out; },
      draw(ctx, c) { shape(ctx, c); }
    };
  }

  // shapes
  function shAND(ctx, c, invert) {
    lead(ctx, -30, -10, -18, -10); lead(ctx, -30, 10, -18, 10);
    ctx.beginPath();
    ctx.moveTo(-18, -16); ctx.lineTo(2, -16);
    ctx.arc(2, 0, 16, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-18, 16); ctx.closePath(); ctx.stroke();
    const ox = invert ? 23 : 18;
    if (invert) { ctx.beginPath(); ctx.arc(21, 0, 3, 0, 7); ctx.stroke(); }
    lead(ctx, ox + 1, 0, 30, 0);
  }
  function shOR(ctx, c, invert, xor) {
    lead(ctx, -30, -10, -20, -10); lead(ctx, -30, 10, -20, 10);
    ctx.beginPath();
    ctx.moveTo(-20, -16);
    ctx.quadraticCurveTo(2, -16, 18, 0);
    ctx.quadraticCurveTo(2, 16, -20, 16);
    ctx.quadraticCurveTo(-10, 0, -20, -16); ctx.stroke();
    if (xor) { ctx.beginPath(); ctx.moveTo(-24, -16); ctx.quadraticCurveTo(-14, 0, -24, 16); ctx.stroke(); }
    const ox = invert ? 23 : 18;
    if (invert) { ctx.beginPath(); ctx.arc(21, 0, 3, 0, 7); ctx.stroke(); }
    lead(ctx, ox + 1, 0, 30, 0);
  }
  function shNOT(ctx) {
    lead(ctx, -30, 0, -16, 0);
    ctx.beginPath(); ctx.moveTo(-16, -14); ctx.lineTo(-16, 14); ctx.lineTo(14, 0); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(17, 0, 3, 0, 7); ctx.stroke();
    lead(ctx, 20, 0, 30, 0);
  }
  function shBUF(ctx) {
    lead(ctx, -30, 0, -16, 0);
    ctx.beginPath(); ctx.moveTo(-16, -14); ctx.lineTo(-16, 14); ctx.lineTo(16, 0); ctx.closePath(); ctx.stroke();
    lead(ctx, 16, 0, 30, 0);
  }

  makeGate('gate-and', 'AND', 2, (i) => i[0] & i[1], (ctx, c) => shAND(ctx, c, false));
  makeGate('gate-or', 'OR', 2, (i) => i[0] | i[1], (ctx, c) => shOR(ctx, c, false, false));
  makeGate('gate-not', 'NOT', 1, (i) => i[0] ? 0 : 1, (ctx) => shNOT(ctx));
  makeGate('gate-buffer', 'BUFFER', 1, (i) => i[0], (ctx) => shBUF(ctx));
  makeGate('gate-nand', 'NAND', 2, (i) => (i[0] & i[1]) ? 0 : 1, (ctx, c) => shAND(ctx, c, true));
  makeGate('gate-nor', 'NOR', 2, (i) => (i[0] | i[1]) ? 0 : 1, (ctx, c) => shOR(ctx, c, true, false));
  makeGate('gate-xor', 'XOR', 2, (i) => i[0] ^ i[1], (ctx, c) => shOR(ctx, c, false, true));
  makeGate('gate-xnor', 'XNOR', 2, (i) => (i[0] ^ i[1]) ? 0 : 1, (ctx, c) => shOR(ctx, c, true, true));

  /* ----------------------------------------------------------- INSTRUMENTS */
  const NCH = 16; // channels for generator / analyzer

  function chPins(side) { // side: +1 right (outputs), -1 left (inputs)
    const pins = [];
    const top = -(NCH - 1) * 8; // 8px spacing → 120 tall span
    for (let i = 0; i < NCH; i++) {
      pins.push({ x: 36 * side, y: top + i * 16, name: (side > 0 ? 'Q' : 'D') + i });
    }
    return pins;
  }
  const INST_H = NCH * 16 + 16; // 272

  T['signal-generator'] = {
    name: 'Signal Generator', cat: 'Instruments', w: 92, h: INST_H,
    pins: chPins(1),
    props: { mode: 'cycle', freq: 2, patterns: [0xAAAA, 0x5555, 0xFF00, 0x00FF] },
    model: 'analog', instrument: 'generator',
    emit: (c, n) => {
      const pats = c.props.patterns && c.props.patterns.length ? c.props.patterns : [0];
      const v = (pats[c._idx || 0] | 0);
      const out = [];
      for (let i = 0; i < NCH; i++) out.push({ kind: 'V', nodes: [n[i], 0], value: ((v >> i) & 1) ? HIGH : LOW });
      return out;
    },
    readout(c) {
      const pats = c.props.patterns && c.props.patterns.length ? c.props.patterns : [0];
      c._cur = (pats[c._idx || 0] | 0) & 0xFFFF;
    },
    draw(ctx, c) {
      const w = 92, h = INST_H;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.save();
      ctx.fillStyle = '#9aa4b2'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText('SIG GEN', -w / 2 + 8, -h / 2 + 14);
      const cur = (c._cur != null) ? c._cur : ((c.props.patterns && c.props.patterns[c._idx || 0]) | 0);
      ctx.fillStyle = '#39d353'; ctx.font = 'bold 13px monospace';
      ctx.fillText('0x' + ((cur | 0) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'), -w / 2 + 8, -h / 2 + 30);
      ctx.fillStyle = '#6e7681'; ctx.font = '9px monospace';
      ctx.fillText((c.props.mode || 'cycle'), -w / 2 + 8, -h / 2 + 44);
      // pin leads + labels + state dots
      ctx.textAlign = 'right';
      for (let i = 0; i < NCH; i++) {
        const py = -(NCH - 1) * 8 + i * 16;
        ctx.strokeStyle = '#cdd9e5';
        ctx.beginPath(); ctx.moveTo(w / 2, py); ctx.lineTo(36, py); ctx.stroke();
        const on = c._cur != null ? ((c._cur >> i) & 1) : 0;
        ctx.fillStyle = on ? '#ff5252' : '#33405a';
        ctx.beginPath(); ctx.arc(w / 2 - 8, py, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#7a8699'; ctx.font = '8px monospace';
        ctx.fillText('Q' + i, w / 2 - 14, py + 3);
      }
      ctx.restore();
    }
  };

  T['logic-analyzer'] = {
    name: 'Logic Analyzer', cat: 'Instruments', w: 92, h: INST_H,
    pins: chPins(-1),
    props: { window: 8 }, model: 'analog', instrument: 'analyzer',
    emit: (c, n) => n.map(node => ({ kind: 'R', nodes: [node, 0], value: 1e9 })),
    readout(c, nv, n) { c._levels = n.map(node => logic(nv[node])); },
    draw(ctx, c) {
      const w = 92, h = INST_H;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.save();
      ctx.fillStyle = '#9aa4b2'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText('LOGIC AN.', -w / 2 + 8, -h / 2 + 14);
      ctx.textAlign = 'left';
      for (let i = 0; i < NCH; i++) {
        const py = -(NCH - 1) * 8 + i * 16;
        ctx.strokeStyle = '#cdd9e5';
        ctx.beginPath(); ctx.moveTo(-w / 2, py); ctx.lineTo(-36, py); ctx.stroke();
        const on = c._levels ? c._levels[i] : 0;
        ctx.fillStyle = on ? '#39d353' : '#33405a';
        ctx.beginPath(); ctx.arc(-w / 2 + 8, py, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#7a8699'; ctx.font = '8px monospace';
        ctx.fillText('D' + i, -w / 2 + 14, py + 3);
      }
      ctx.restore();
    }
  };

  global.Components = { TYPES: T, HIGH, LOW, THRESH, logic, NCH };
})(window);
