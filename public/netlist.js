/* =====================================================================
 * netlist.js — build nets from components + wires, run the simulation
 * ===================================================================== */
(function (global) {
  'use strict';

  const TYPES = () => global.Components.TYPES;

  // union-find
  function makeUF() {
    const parent = {};
    function find(x) {
      if (parent[x] === undefined) parent[x] = x;
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    return { find, union, parent };
  }

  const pinKey = (compId, pinIdx) => compId + '#' + pinIdx;

  /**
   * build node assignment.
   * @returns { nodeOf(compId,pinIdx)->int, nNodes, warnings[] }
   */
  function buildNodes(components, wires) {
    const uf = makeUF();
    const warnings = [];

    // register every pin
    for (const c of components) {
      const t = TYPES()[c.type];
      t.pins.forEach((_, i) => uf.find(pinKey(c.id, i)));
    }
    // wires merge pins
    for (const w of wires) {
      uf.union(pinKey(w.a.comp, w.a.pin), pinKey(w.b.comp, w.b.pin));
    }

    // collect ground roots
    let groundRoot = null;
    let hasGround = false;
    for (const c of components) {
      if (c.type === 'ground') {
        hasGround = true;
        const k = pinKey(c.id, 0);
        if (groundRoot === null) groundRoot = uf.find(k);
        else uf.union(uf.find(k), groundRoot);
        groundRoot = uf.find(k);
      }
    }

    // assign node numbers: ground root -> 0
    const rootToNode = {};
    if (groundRoot !== null) rootToNode[uf.find(groundRoot)] = 0;
    let next = 1;
    const nodeOf = (compId, pinIdx) => {
      const r = uf.find(pinKey(compId, pinIdx));
      if (rootToNode[r] === undefined) rootToNode[r] = next++;
      return rootToNode[r];
    };
    // assign all
    for (const c of components) {
      const t = TYPES()[c.type];
      t.pins.forEach((_, i) => nodeOf(c.id, i));
    }
    const nNodes = next; // node ids 0..next-1 (0 exists as reference even if no ground)

    if (!hasGround) warnings.push('No ground placed — node 0 used as floating reference.');

    return { nodeOf, nNodes: Math.max(1, nNodes), warnings, hasGround };
  }

  /**
   * simulate — full analog + iterative logic co-sim.
   * mutates each component with readout fields (_I, _on, _reading...) and ._nodes.
   * @returns { ok, nodeV, nNodes, nodeOf, warnings }
   */
  function simulate(components, wires) {
    const { nodeOf, nNodes, warnings } = buildNodes(components, wires);

    // cache each comp's node array
    for (const c of components) {
      const t = TYPES()[c.type];
      c._nodes = t.pins.map((_, i) => nodeOf(c.id, i));
      if (t.model === 'gate' && c._out === undefined) c._out = 0;
    }

    let nodeV = new Array(nNodes).fill(0);
    let ok = true;
    const MAX = 80;

    let lastElements = [];
    for (let iter = 0; iter < MAX; iter++) {
      // assemble primitives, tagging each with its owning component
      const elements = [];
      for (const c of components) {
        const t = TYPES()[c.type];
        if (t.emit) {
          const prim = t.emit(c, c._nodes);
          for (const p of prim) { p._comp = c; elements.push(p); }
        }
      }

      const res = global.Engine.solveMNA(nNodes, elements);
      ok = res.ok;
      nodeV = res.nodeV;
      lastElements = elements;

      // update logic states
      let changed = false;
      for (const c of components) {
        const t = TYPES()[c.type];
        if (t.model === 'gate') {
          const prev = c._out;
          t.evalLogic(c, nodeV, c._nodes);
          if (c._out !== prev) changed = true;
        }
      }
      if (!changed) break;
    }

    // source branch currents: V element objects carry _current after solve
    for (const c of components) c._srcI = undefined;
    for (const e of lastElements) {
      if (e.kind === 'V' && e._comp && e._current !== undefined) {
        // current leaving + terminal of the source
        e._comp._srcI = -e._current;
      }
    }

    // readouts
    for (const c of components) {
      const t = TYPES()[c.type];
      if (t.readout) t.readout(c, nodeV, c._nodes);
    }

    return { ok, nodeV, nNodes, nodeOf, warnings };
  }

  global.Netlist = { simulate, buildNodes };
})(window);
