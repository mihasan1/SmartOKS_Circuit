/* =====================================================================
 * engine.js — numeric core
 *   - Gaussian elimination linear solver
 *   - Modified Nodal Analysis (MNA) DC solver
 *
 * Works on a list of primitive elements:
 *   { kind: 'R', nodes:[a,b], value: ohms }
 *   { kind: 'V', nodes:[p,n], value: volts }   (voltage source)
 *   { kind: 'I', nodes:[p,n], value: amps  }   (current source, p -> n)
 *
 * Node 0 is always the ground / reference node.
 * ===================================================================== */
(function (global) {
  'use strict';

  const GMIN = 1e-9; // tiny conductance to ground on every node (avoids singular matrix)

  // Solve A x = b  (in place, partial pivoting). Returns x or null if singular.
  function solveLinear(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      // pivot
      let max = Math.abs(A[i][i]);
      let pivot = i;
      for (let r = i + 1; r < n; r++) {
        if (Math.abs(A[r][i]) > max) { max = Math.abs(A[r][i]); pivot = r; }
      }
      if (max < 1e-18) return null; // singular
      if (pivot !== i) {
        const tmp = A[i]; A[i] = A[pivot]; A[pivot] = tmp;
        const tb = b[i]; b[i] = b[pivot]; b[pivot] = tb;
      }
      // eliminate
      const piv = A[i][i];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / piv;
        if (f === 0) continue;
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    // back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = s / A[i][i];
    }
    return x;
  }

  /**
   * solveMNA
   * @param {number} nNodes  total nets (including ground = 0)
   * @param {Array}  elements primitive elements
   * @returns {{ nodeV:number[], branchI:number[], ok:boolean }}
   */
  function solveMNA(nNodes, elements) {
    const vSources = elements.filter(e => e.kind === 'V');
    const nV = vSources.length;
    const size = (nNodes - 1) + nV;

    if (size <= 0) {
      return { nodeV: new Array(nNodes).fill(0), branchI: [], ok: true };
    }

    // allocate
    const A = [];
    for (let i = 0; i < size; i++) A.push(new Array(size).fill(0));
    const z = new Array(size).fill(0);

    // node index -> matrix row (node 0 -> -1)
    const idx = (node) => node - 1;

    // gmin to ground
    for (let n = 1; n < nNodes; n++) A[idx(n)][idx(n)] += GMIN;

    // stamp R and I
    for (const e of elements) {
      if (e.kind === 'R') {
        const g = 1 / (e.value <= 0 ? 1e-9 : e.value);
        const [a, b] = e.nodes;
        if (a > 0) A[idx(a)][idx(a)] += g;
        if (b > 0) A[idx(b)][idx(b)] += g;
        if (a > 0 && b > 0) { A[idx(a)][idx(b)] -= g; A[idx(b)][idx(a)] -= g; }
      } else if (e.kind === 'I') {
        const [p, n] = e.nodes;
        if (p > 0) z[idx(p)] -= e.value;
        if (n > 0) z[idx(n)] += e.value;
      }
    }

    // stamp V sources
    const base = nNodes - 1;
    vSources.forEach((e, j) => {
      const row = base + j;
      const [p, n] = e.nodes;
      if (p > 0) { A[idx(p)][row] += 1; A[row][idx(p)] += 1; }
      if (n > 0) { A[idx(n)][row] -= 1; A[row][idx(n)] -= 1; }
      z[row] = e.value;
    });

    const x = solveLinear(A, z);
    if (!x) {
      return { nodeV: new Array(nNodes).fill(0), branchI: new Array(nV).fill(0), ok: false };
    }

    const nodeV = new Array(nNodes).fill(0);
    for (let n = 1; n < nNodes; n++) nodeV[n] = x[idx(n)];
    const branchI = [];
    for (let j = 0; j < nV; j++) branchI.push(x[base + j]);

    // attach branch current back onto the source elements for convenience
    vSources.forEach((e, j) => { e._current = branchI[j]; });

    return { nodeV, branchI, ok: true };
  }

  global.Engine = { solveLinear, solveMNA };
})(window);
