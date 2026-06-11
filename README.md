# EngraveLab

Browser-based engraving G-code generator for electrical labels (solar/battery signage, Australian standards). Designed for Traffolyte (multi-layer engraving plastic) on a PROVerXL 4030 V2 CNC router, but configurable for any Grbl, Mach3/4, or LinuxCNC machine.

**Core principle — engraving-first G-code:** all text, symbols, and engrave-mode shapes are machined before any through-cut. Cut-mode shapes free the label from the stock sheet, so they always run last (innermost first, outermost outline at the very end). This order is enforced in the generator and cannot be misconfigured.

## Running

```bash
npm install
npm run dev        # development server with HMR
npm run build      # static production build in dist/
npx serve dist     # serve the build locally (works offline once loaded)
npm test           # unit tests (geometry, fonts, G-code, dialects)
```

No server-side anything — the static build runs entirely in the browser.

## Features

- **Excalidraw-style canvas**: click to select, drag to move, 8 resize handles, rotation handle, marquee multi-select, Shift+click, pan (middle-drag / Space+drag), scroll-wheel zoom centred on the cursor
- **Elements**: stroke-font text (Hershey Simplex + Roman), symbols (warning triangle, lightning bolt, no-entry), and shapes (rectangle, circle, triangle, line, flash)
- **Shapes engrave or cut**: every shape has an engrave/cut mode. Cut shapes (drawn in red) cut through the material and define the label outline — resize them with handles like any element, so any label shape is possible. New projects start with a cut rectangle at the machine origin
- **Panelisation** (File → Panelise & export): enter the available sheet size and it tiles the outermost cut shape packed from the origin corner, leftover stock kept to one side. Square rectangles use a shared-edge guillotine grid — adjacent labels share a single cut line, the minimum number of unique cuts. Circles use hexagonal packing when it fits more parts than a grid. All cells are engraved before any cut
- **Multi-pass strokes**: thicken lines with N parallel offset passes — no fill fonts needed
- **Snapping**: 0.5 mm grid (Ctrl to bypass), alignment guides against other elements and the label boundary, align/distribute buttons
- **G-code export**: Grbl / Mach3 / LinuxCNC dialects, preview, time estimate, validation (out-of-bounds warnings, work-area errors that block export), browser download
- **Machine profiles**: built-in PROVerXL 4030 V2; create, edit, duplicate, import/export profiles (user profiles persist in localStorage)
- **Projects**: auto-persisted to localStorage; save/open as `.elb` JSON files
- **Units**: mm (default) or inches display toggle — all data is stored in mm
- **Undo/redo**, dark mode, keyboard shortcuts (`V`/`T`/`S`/`B` tools, `Ctrl+Z/Y`, `Ctrl+D`, `Ctrl+S/O/E`, `Ctrl+0`, `Ctrl+Shift+H` fit)
- **Plugin infrastructure**: load an ES-module plugin from a URL (Help menu); plugins can register fonts, symbols, dialects, menu and toolbar items

## Architecture

```
src/
├── canvas/           # rendering + pointer interaction (rAF loop, hit-testing, handles, snapping)
├── elements/         # element types → mm stroke polylines
├── fonts/            # JSON stroke fonts (Hershey), layout, multi-pass expansion
├── symbols/          # built-in symbol library
├── gcode/            # PURE TS: toolpath ordering, dialects, generator, paneliser, time estimator
├── machineProfiles/  # built-in + localStorage user profiles
├── plugins/          # plugin loader + AppContext API
├── store/            # Zustand slices: project, machine, ui, history
├── ui/               # React components: toolbar, properties, dialogs, status bar
└── utils/            # geometry, unit conversion, file I/O
```

`gcode/`, `fonts/`, `symbols/`, and `machineProfiles/` have zero React/UI imports and can be reused in a CLI or Web Worker unchanged.

### Coordinate systems

- **Label space**: mm, y-down, origin at the label's top-left (data model + canvas)
- **Machine space**: mm, y-up. The export origin (X, Y) is where the label's bottom-left corner sits on the bed; the generator flips Y: `machineY = originY + (labelHeight − labelY)`

### Fonts

Stroke fonts are JSON: glyph → polylines in normalised space (y = 0 at cap top, y = 1 at baseline). The shipped fonts are converted from the public-domain Hershey fonts (`futural` → Simplex, `timesr` → Roman). Add a font by dropping a JSON file in `src/fonts/data/` and registering it in `fontRegistry.ts`.
