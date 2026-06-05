# SmartOKS Circuit

A browser-based **Electronics Workbench** — build and simulate **analog & digital
circuits** right in the browser. Inspired by tools like Multisim / Electronics
Workbench, it ships sources, passives, indicators, switches, meters, logic gates,
and lab instruments (a 16-channel signal generator and a 16-channel logic
analyzer), with a real numerical solver under the hood.

**Live demo:** https://smartoks-circuit.vercel.app

The backend is a tiny dependency-free **Node.js** static server; all of the
schematic editor and the simulation engine run client-side.

---

## Quick start

```bash
npm start              # serves on http://localhost:3001
PORT=4000 npm start    # custom port
```

No `npm install` needed — there are no runtime dependencies.

---

## Features

### Schematic editor
- **Drag-and-drop** parts from the sidebar onto a snapping grid.
- **Pin-to-pin wiring** — click one pin, then another, to connect.
- **Rotate** (`R`), **delete** (`Del`), move, and select to edit in the side panel.
- **Live wire coloring** by node voltage while running (red = +, blue = −).
- **Save / Load** circuits as JSON, plus automatic local autosave.
- **Light & dark themes** with a top-bar toggle (the canvas re-themes too).
- **Bilingual UI — English & Ukrainian.**
- In-app **Help dialog** with a full usage guide.

### Component library
| Group | Parts |
|-------|-------|
| **Sources** | DC voltage source, battery, **current source**, +5 V rail, **ground** |
| **Passive** | resistor, potentiometer |
| **Indicators** | lamp (brightness-scaled), LED (polarity-aware) |
| **Switches** | SPST switch, push button |
| **Meters** | voltmeter, ammeter (live readings) |
| **Digital** | logic switch, logic 1, logic 0, logic probe |
| **Logic gates** | AND, OR, NOT, BUFFER, NAND, NOR, XOR, XNOR |
| **Instruments** | Signal Generator, Logic Analyzer |

### Signal Generator (16 outputs)
- 16 outputs **Q0…Q15**, driven by a programmable list of **signal rows**.
- Each row is a 16-bit word shown and editable as **hexadecimal** — click
  individual bits, type the hex value, or **bulk-import** (one hex or 16-bit
  binary value per line).
- Run modes:
  - **Burst** — play through every row once.
  - **Cycle** — loop through all rows continuously.
  - **Step** — advance one row per click.
- Adjustable **frequency** (Hz) for Burst / Cycle.

### Logic Analyzer (16 channels)
- 16 inputs **D0…D15**; wire any signals to it.
- Captures a **live timing diagram** in the bottom dock while the simulation runs.
- Adjustable time window and a clear-capture control.

### Simulation engine
- **Analog DC** solved with **Modified Nodal Analysis** (Gaussian elimination
  with partial pivoting).
- **Logic gates** are co-simulated iteratively (input threshold 2.5 V, outputs
  drive 0 / 5 V) until the network settles — so analog and digital parts can be
  mixed in a single schematic.
- A real-time clock loop drives the signal generator and the analyzer capture.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `R` | Rotate selected part |
| `Del` / `Backspace` | Delete selected part |
| `Esc` | Cancel placing / wiring, or close the Help dialog |
| Double-click | Toggle a switch or logic input |

---

## Project structure

| File | Purpose |
|------|---------|
| `server.js` | Node.js static file server (no dependencies) |
| `public/icons.js` | inline SVG icon set |
| `public/i18n.js` | English / Ukrainian localization + Help content |
| `public/engine.js` | linear solver + Modified Nodal Analysis |
| `public/components.js` | component registry (symbol drawing + electrical model) |
| `public/netlist.js` | net building (union-find) + analog/digital co-simulation |
| `public/editor.js` | schematic editor, UI, real-time clock, instruments |
| `vercel.json` | static deployment config |

### Adding a component
Register one entry in `public/components.js` with a `draw(ctx, comp)` function
(its schematic symbol) and an `emit(comp, nodes)` function returning primitive
elements (`R`, `V`, `I`) for the solver. Pins, properties, and the palette entry
are derived automatically.

---

## Deployment

Deployed to Vercel as a static site (`@vercel/static` over `public/`):

```bash
npx vercel deploy --prod --yes
```

---

## License
MIT
