import type { Label, ShapeElement } from '../elements/types';
import type { MachineProfile } from '../machineProfiles/types';
import { assembleProgram, dialects, fmt, type GenerateResult, type ProgramContext } from './generator';
import { grbl } from './dialects/grbl';
import {
  buildEngraveOps,
  describeElement,
  elementDepth,
  elementPasses,
  findOuterCutShape,
  isCutShape,
  orderElements,
  type PathOp,
} from './toolpath';
import type { BBox, Vec2 } from '../utils/geometry';

export { findOuterCutShape };

export type PanelStrategy = 'grid-shared' | 'grid' | 'hex';

export interface PanelPlan {
  strategy: PanelStrategy;
  /** Tile = bbox of the outermost cut shape, in mm. */
  tileW: number;
  tileH: number;
  /** Bottom-left corner of each tile, in sheet space (mm, y-up from sheet bottom-left). */
  cells: Vec2[];
  cols: number;
  rows: number;
  count: number;
  outerShape: ShapeElement;
}

export interface PanelOptions {
  label: Label;
  profile: MachineProfile;
  /** Available stock sheet size in mm. */
  sheetW: number;
  sheetH: number;
  /** mm offset of the sheet's bottom-left corner on the machine bed. */
  originX: number;
  originY: number;
  projectName?: string;
}

interface CellLayout {
  cells: Vec2[];
  cols: number;
  rows: number;
}

function gridLayout(tileW: number, tileH: number, sheetW: number, sheetH: number): CellLayout {
  const cols = Math.floor((sheetW + 1e-9) / tileW);
  const rows = Math.floor((sheetH + 1e-9) / tileH);
  const cells: Vec2[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: c * tileW, y: r * tileH });
    }
  }
  return { cells, cols, rows };
}

/** Offset rows at √3/2 pitch; circles in adjacent rows touch at a point. */
function hexLayout(tileW: number, tileH: number, sheetW: number, sheetH: number): CellLayout {
  const pitch = (tileH * Math.sqrt(3)) / 2;
  const cells: Vec2[] = [];
  let cols = 0;
  let rows = 0;
  let y = 0;
  let row = 0;
  while (y + tileH <= sheetH + 1e-9) {
    let x = row % 2 === 1 ? tileW / 2 : 0;
    let rowCols = 0;
    while (x + tileW <= sheetW + 1e-9) {
      cells.push({ x, y });
      rowCols++;
      x += tileW;
    }
    cols = Math.max(cols, rowCols);
    if (rowCols > 0) rows++;
    y += pitch;
    row++;
  }
  return { cells, cols, rows };
}

/**
 * Lay out tiles in the available sheet, packed from the bottom-left (machine
 * origin) corner so leftover stock stays in one piece on the far sides.
 *
 * - grid-shared: square-corner rectangles share guillotine cut lines.
 * - hex:         circles in offset rows; chosen only when it fits MORE parts
 *                than a plain grid (it loses one circle per offset row, so it
 *                only wins on sheets tall enough for extra rows).
 * - grid:        any other outline; tiles touch edge-to-edge, cut individually.
 */
export function planPanel(label: Label, sheetW: number, sheetH: number): PanelPlan | null {
  const outer = findOuterCutShape(label);
  if (!outer) return null;
  const tileW = outer.width;
  const tileH = outer.height;

  let strategy: PanelStrategy;
  let layout: CellLayout;
  if (outer.rotation === 0 && outer.shapeKind === 'rectangle' && outer.cornerRadius <= 0.01) {
    strategy = 'grid-shared';
    layout = gridLayout(tileW, tileH, sheetW, sheetH);
  } else if (outer.rotation === 0 && outer.shapeKind === 'circle') {
    const hex = hexLayout(tileW, tileH, sheetW, sheetH);
    const grid = gridLayout(tileW, tileH, sheetW, sheetH);
    if (hex.cells.length > grid.cells.length) {
      strategy = 'hex';
      layout = hex;
    } else {
      strategy = 'grid';
      layout = grid;
    }
  } else {
    strategy = 'grid';
    layout = gridLayout(tileW, tileH, sheetW, sheetH);
  }

  if (layout.cells.length === 0) return null;
  return { strategy, tileW, tileH, ...layout, count: layout.cells.length, outerShape: outer };
}

/**
 * Generate a panelised job: every cell's engraving first, then all cuts.
 * Cut order per cell: inner cut shapes (small → large), outer outline last.
 * With the shared-grid strategy the outer outlines collapse into
 * (cols+1) + (rows+1) straight guillotine lines — the minimum unique cuts.
 */
export function generatePanelGcode(opts: PanelOptions): (GenerateResult & { plan: PanelPlan }) | null {
  const { label, profile, originX, originY } = opts;
  const plan = planPanel(label, opts.sheetW, opts.sheetH);
  if (!plan) return null;
  const { outerShape, tileW, tileH, cells } = plan;
  const outerBox: BBox = { x: outerShape.x, y: outerShape.y, width: tileW, height: tileH };

  // Label-space point → machine space for a given cell (cell is the tile's
  // bottom-left in sheet space; the tile covers the outer shape's bbox).
  const toMachine = (p: Vec2, cell: Vec2): Vec2 => ({
    x: originX + cell.x + (p.x - outerBox.x),
    y: originY + cell.y + (outerBox.y + outerBox.height - p.y),
  });

  const ordered = orderElements(label.elements);
  const cutEls = ordered.filter(isCutShape);

  const ops: PathOp[] = [];

  // 1. All engraving, cell by cell, through the SAME engraving builder the
  //    single-label generator uses — so a letter (welded strokes, bold fill,
  //    travel order) machines identically however many tiles it is repeated on.
  //    The tool position chains from one cell to the next to minimise travel.
  let cur: Vec2 = { x: originX, y: originY };
  cells.forEach((cell, ci) => {
    const engrave = buildEngraveOps(
      label.elements,
      profile,
      (p) => toMachine(p, cell),
      cur,
      (el) => `cell ${ci + 1}: ${describeElement(el)}`,
    );
    ops.push(...engrave.ops);
    cur = engrave.end;
  });

  // 2. All cuts, after every cell is engraved. Cuts are where the two jobs
  //    legitimately differ: a single label cuts its own outline, a panel frames
  //    the whole sheet — shared guillotine lines for a grid, or per-cell outlines
  //    otherwise. The cut geometry itself still flows through the shared
  //    elementPasses so depth and retract handling stay consistent.
  if (plan.strategy === 'grid-shared') {
    // Inner cut shapes (everything but the shared outline) still cut per cell.
    const innerCuts = cutEls.filter((el) => el.id !== outerShape.id);
    cells.forEach((cell, ci) => {
      for (const el of innerCuts) {
        ops.push(...elementPasses(el, profile, (p) => toMachine(p, cell), `cell ${ci + 1}: inner cut`));
      }
    });
    // Shared guillotine grid: one line per shared edge.
    const depth = elementDepth(outerShape, profile);
    const panelW = plan.cols * tileW;
    const panelH = plan.rows * tileH;
    for (let c = 0; c <= plan.cols; c++) {
      ops.push({
        points: [
          { x: originX + c * tileW, y: originY },
          { x: originX + c * tileW, y: originY + panelH },
        ],
        depth,
        cut: true,
        comment: c === 0 ? 'shared grid cuts (vertical)' : undefined,
      });
    }
    for (let r = 0; r <= plan.rows; r++) {
      ops.push({
        points: [
          { x: originX, y: originY + r * tileH },
          { x: originX + panelW, y: originY + r * tileH },
        ],
        depth,
        cut: true,
        comment: r === 0 ? 'shared grid cuts (horizontal)' : undefined,
      });
    }
  } else {
    cells.forEach((cell, ci) => {
      for (const el of cutEls) {
        ops.push(...elementPasses(el, profile, (p) => toMachine(p, cell), `cell ${ci + 1}: ${describeElement(el)}`));
      }
    });
  }

  // Assemble through the shared program builder so a panel machines with the
  // exact same motion (and retract logic) as a single label.
  const dialect = dialects[profile.gcodeDialect] ?? grbl;
  const ctx: ProgramContext = { profile, projectName: opts.projectName ?? label.name };
  const gcode = assembleProgram(ops, profile, ctx, [
    `EngraveLab panel - ${ctx.projectName}`,
    `${plan.count} tiles (${plan.tileW} x ${plan.tileH} mm, ${plan.strategy}) on ${opts.sheetW} x ${opts.sheetH} mm sheet at X${fmt(originX)} Y${fmt(originY)}`,
    `Machine: ${profile.name} (${dialect.name})`,
    'All engraving first, all cuts last',
  ]);

  return { gcode, ops, plan };
}
