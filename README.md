# ⚡ SmartOKS Circuit

A browser-based **Electronics Workbench / Multisim-style** analog & digital circuit
simulator. Pure **Node.js** static server + an in-browser simulation engine
(Modified Nodal Analysis for analog, iterative co-simulation for logic).

> Симулятор електронних схем (аналог Electronics Workbench) — аналогові та
> цифрові кола, генератор сигналів і логічний аналізатор. Інтерфейс англійською
> та українською мовами.

## Run locally

```bash
npm start            # → http://localhost:3001
# custom port:
PORT=4000 npm start
```

No dependencies — the server (`server.js`) only serves the static files in `public/`.

## Features

### Components / Компоненти
- **Sources:** DC voltage, battery, **current source**, +5 V rail, **ground**
- **Passive:** resistor, potentiometer
- **Indicators:** lamp (brightness), LED (polarity-aware)
- **Switches:** SPST, push button
- **Meters:** voltmeter, ammeter (live readings)
- **Digital:** logic switch, logic 1/0, logic probe
- **Logic gates:** AND, OR, NOT, BUFFER, NAND, NOR, XOR, XNOR
- **Instruments:**
  - **Signal Generator** — 16 outputs, rows of 0/1 patterns shown in **hex**,
    modes **burst** (one pass), **cycle** (loop), **step** (manual), adjustable
    frequency, bulk import (hex / 16-bit binary).
  - **Logic Analyzer** — 16 channels, live timing-diagram capture.

### Simulation
- Analog DC solved with **Modified Nodal Analysis** (Gaussian elimination).
- Logic gates co-simulated iteratively (threshold 2.5 V, outputs drive 0/5 V),
  so analog and digital parts mix in one schematic.
- Real-time clock loop drives the signal generator and logic-analyzer capture.

### UI
- Drag-and-drop schematic editor, pin-to-pin wiring, rotation, properties panel.
- Live wire coloring by node voltage, save/load JSON, autosave.
- **i18n: English & Ukrainian** (switch in the top bar).

## Architecture

| File | Purpose |
|------|---------|
| `server.js` | Node.js static file server |
| `public/i18n.js` | English / Ukrainian localization |
| `public/engine.js` | linear solver + MNA |
| `public/components.js` | component registry (symbol + electrical model) |
| `public/netlist.js` | net building (union-find) + analog/digital co-simulation |
| `public/editor.js` | schematic editor, UI, clock, instruments |

## License
MIT
