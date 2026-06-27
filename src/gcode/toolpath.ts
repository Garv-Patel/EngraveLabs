import type { Element, Label, ShapeElement } from '../elements/types';
import type { MachineProfile } from '../machineProfiles/types';
import { textElementStrokes } from '../elements/TextElement';
import { symbolElementStrokes } from '../elements/SymbolElement';
import { shapeElementStrokes } from '../elements/ShapeElement';
import type { Polyline } from '../fonts/strokeRenderer';
import { resolveBit } from '../machineProfiles/bits';
import { boldStrokeWidth, fillStroke } from './fill';
import { distance, type BBox, type Vec2 } from '../utils/geometry';

/** One continuous engraving path at a single depth, in machine coordinates (y-up). */
export interface PathOp {
  points: Vec2[];
  depth: number; // mm below material surface (positive value)
  comment?: string;
  /** True for through-cut passes, which must clear the stock to reposition. */
  cut?: boolean;
}

/**
 * Two engraving strokes that meet within this distance (mm) are treated as a
 * single continuous path: the tool can slide from one to the next at depth
 * because there is no gap to drag across. Anything wider is a reposition.
 */
const CONTIGUOUS_EPS = 1e-3;

/**
 * Whether the tool must lift clear to safe Z before machining `op`, given the
 * op machined just before it (null when `op` is the first). Unlike a laser, this
 * CNC keeps the spindle running, so where one stroke ends exactly where the next
 * begins it slides straight through at depth — no retract needed.
 *
 * It must lift, though, whenever repositioning would otherwise drag the bit
 * through stock: a through-cut, a move to or from one, a depth change that needs
 * re-plunging, or — the common case — a gap between strokes. Successive letters
 * (and the disjoint strokes within a single glyph) start nowhere near where the
 * previous stroke ended, so sliding at depth would score a straight line across
 * the gap, cutting through whatever lies between. Lift and reposition instead.
 */
export function needsRetract(op: PathOp, prev: PathOp | null): boolean {
  if (!prev) return true;
  if (op.cut || prev.cut || op.depth !== prev.depth) return true;
  const prevEnd = prev.points[prev.points.length - 1];
  return distance(prevEnd, op.points[0]) > CONTIGUOUS_EPS;
}

export interface ToolpathOptions {
  label: Label;
  profile: MachineProfile;
  /** mm offset of the part's bottom-left corner on the machine bed. */
  originX: number;
  originY: number;
}

export function isCutShape(el: Element): el is ShapeElement {
  return el.type === 'shape' && el.mode === 'cut';
}

/** The outermost cut shape (largest bbox area) defines the part outline. */
export function findOuterCutShape(label: Label): ShapeElement | null {
  const cuts = label.elements.filter(isCutShape);
  if (cuts.length === 0) return null;
  return cuts.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
}

/**
 * Bounding box of the part, in label space. This is the outermost cut shape —
 * the actual outline the machine frees from the stock — falling back to the
 * label rectangle only when nothing has been marked for cutting yet.
 */
export function partBBox(label: Label): BBox {
  const outer = findOuterCutShape(label);
  if (outer) return { x: outer.x, y: outer.y, width: outer.width, height: outer.height };
  return { x: 0, y: 0, width: label.width, height: label.height };
}

/**
 * Label space (mm, y-down) → machine space (mm, y-up), placing the part's
 * bottom-left corner at (originX, originY) on the bed.
 */
export function partToMachine(p: Vec2, part: BBox, originX: number, originY: number): Vec2 {
  return { x: originX + (p.x - part.x), y: originY + (part.y + part.height - p.y) };
}

export function elementDepth(el: Element, profile: MachineProfile): number {
  if (isCutShape(el)) {
    // Cut shapes free the part: default depth is full material thickness.
    return el.engraveDepth ?? profile.materialThickness;
  }
  return el.engraveDepth ?? profile.engraveDepth;
}

/** Resolved bold-fill settings for an element, or null when it is not bold text. */
export interface BoldFill {
  /** Target engraved stroke width, mm. */
  width: number;
  /** Diameter of the element's bit, mm. */
  bitDiameter: number;
}

/**
 * Bold-fill settings for an element, honouring its per-element width override,
 * or null for anything that isn't bold text. Shared by the single-label and
 * panelised generators so bold thickening behaves identically in both.
 */
export function resolveBoldFill(el: Element, profile: MachineProfile): BoldFill | null {
  if (el.type !== 'text' || el.bold !== true) return null;
  const bit = resolveBit(profile, el.bitId);
  return { width: boldStrokeWidth(bit.diameter, el.boldWidth), bitDiameter: bit.diameter };
}

/**
 * Expand one machine-space stroke into the passes that engrave it: just the
 * centreline normally, or the centreline plus parallel bold-fill passes when
 * `bold` is set.
 */
export function strokePasses(machineStroke: Vec2[], bold: BoldFill | null): Vec2[][] {
  return bold ? fillStroke(machineStroke, bold.width, bold.bitDiameter) : [machineStroke];
}

export function elementStrokes(el: Element): Polyline[] {
  switch (el.type) {
    case 'text':
      return textElementStrokes(el);
    case 'symbol':
      return symbolElementStrokes(el);
    case 'shape':
      return shapeElementStrokes(el);
  }
}

function describeElement(el: Element): string {
  switch (el.type) {
    case 'text':
      return `text "${el.text.split('\n')[0].slice(0, 30)}"`;
    case 'symbol':
      return `symbol ${el.symbolName}`;
    case 'shape':
      return el.mode === 'cut' ? `cut ${el.shapeKind}` : `shape ${el.shapeKind}`;
  }
}

/**
 * Machining order, strictly enforced: text → symbols → engrave shapes →
 * cut shapes LAST (smallest area first, so inner cutouts are released before
 * the outermost outline frees the whole part from the stock sheet).
 * Not user-configurable: cutting first would make in-place engraving impossible.
 */
export function orderElements(elements: Element[]): Element[] {
  const texts = elements.filter((e) => e.type === 'text');
  const symbols = elements.filter((e) => e.type === 'symbol');
  const engraveShapes = elements.filter((e) => e.type === 'shape' && e.mode === 'engrave');
  const cutShapes = elements
    .filter(isCutShape)
    .sort((a, b) => a.width * a.height - b.width * b.height);
  return [...texts, ...symbols, ...engraveShapes, ...cutShapes];
}

/**
 * Stitch polylines that meet end-to-end into longer continuous paths.
 *
 * Glyphs are stored as separate strokes even where they join at a vertex: a
 * Hershey "W" is four diagonals sharing three corners, yet it can be engraved in
 * one unbroken pen-down. Left as four strokes, the travel optimiser enters one at
 * a shared corner and exits at a free tip, stranding the rest a stroke-width away
 * and forcing a needless retract/replunge at every junction. Welding shared
 * endpoints first turns the whole "W" into a single path — one plunge, no lifts,
 * identical engraved geometry — which is the bulk of the engraving-time saving.
 *
 * Greedy chaining: seed with a stroke, then keep absorbing any unused stroke that
 * touches either end (reversing it as needed) until none do. A vertex where three
 * or more strokes meet only consumes two of them per chain; the rest seed their
 * own chains, exactly as a single continuous pen could not cover them either.
 */
export function chainStrokes(strokes: Vec2[][], eps = CONTIGUOUS_EPS): Vec2[][] {
  const near = (a: Vec2, b: Vec2) => distance(a, b) <= eps;
  const used = new Array(strokes.length).fill(false);
  const chains: Vec2[][] = [];

  for (let i = 0; i < strokes.length; i++) {
    if (used[i] || strokes[i].length < 2) continue;
    used[i] = true;
    const chain = strokes[i].slice();

    // Grow forward from the tail, then backward from the head.
    for (let grew = true; grew; ) {
      grew = false;
      const tail = chain[chain.length - 1];
      for (let j = 0; j < strokes.length; j++) {
        if (used[j] || strokes[j].length < 2) continue;
        const s = strokes[j];
        if (near(tail, s[0])) chain.push(...s.slice(1));
        else if (near(tail, s[s.length - 1])) chain.push(...s.slice(0, -1).reverse());
        else continue;
        used[j] = true;
        grew = true;
        break;
      }
    }
    for (let grew = true; grew; ) {
      grew = false;
      const head = chain[0];
      for (let j = 0; j < strokes.length; j++) {
        if (used[j] || strokes[j].length < 2) continue;
        const s = strokes[j];
        if (near(head, s[s.length - 1])) chain.unshift(...s.slice(0, -1));
        else if (near(head, s[0])) chain.unshift(...s.slice(1).reverse());
        else continue;
        used[j] = true;
        grew = true;
        break;
      }
    }
    chains.push(chain);
  }
  return chains;
}

/** A polyline is closed when its last point coincides with its first. */
const CLOSED_EPS = 1e-6;
function isClosedPath(points: Vec2[]): boolean {
  return points.length >= 3 && distance(points[0], points[points.length - 1]) <= CLOSED_EPS;
}

/** Rotate a closed polyline so it begins (and ends) at the vertex nearest `from`. */
function rotateClosedToNearest(points: Vec2[], from: Vec2): Vec2[] {
  const n = points.length - 1; // last vertex duplicates the first
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const d = distance(points[i], from);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best === 0) return points;
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) out.push(points[(best + i) % n]);
  return out;
}

/**
 * The cheapest way to enter a path from the current tool position: open paths
 * may be reversed to start from whichever end is closer; closed loops are
 * rotated to start at their nearest vertex. The engraved geometry is identical
 * either way — only the rapid hop and the plunge point change.
 */
function entryFor(op: PathOp, from: Vec2): { dist: number; points: Vec2[] } {
  const pts = op.points;
  if (isClosedPath(pts)) {
    const rotated = rotateClosedToNearest(pts, from);
    return { dist: distance(from, rotated[0]), points: rotated };
  }
  const dStart = distance(from, pts[0]);
  const dEnd = distance(from, pts[pts.length - 1]);
  if (dEnd < dStart) return { dist: dEnd, points: pts.slice().reverse() };
  return { dist: dStart, points: pts };
}

const endOf = (points: Vec2[]): Vec2 => points[points.length - 1];

/**
 * Greedy nearest-neighbour reorder of a set of engraving ops to minimise the
 * rapid (G0) travel that joins them. At each step it picks the unvisited path
 * whose nearest entry point is closest to the tool, orienting that path for the
 * shortest approach. This is the dominant cost in label engraving — hundreds of
 * short strokes were previously machined in arbitrary renderer order.
 */
export function optimizeTravel(ops: PathOp[], start: Vec2): { ops: PathOp[]; end: Vec2 } {
  const remaining = ops.slice();
  const result: PathOp[] = [];
  let cur = start;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestEntry = entryFor(remaining[0], cur);
    for (let i = 1; i < remaining.length; i++) {
      const entry = entryFor(remaining[i], cur);
      if (entry.dist < bestEntry.dist) {
        bestIdx = i;
        bestEntry = entry;
      }
    }
    const [picked] = remaining.splice(bestIdx, 1);
    result.push({ ...picked, points: bestEntry.points });
    cur = endOf(bestEntry.points);
  }
  return { ops: result, end: cur };
}

/**
 * Keep the ops in their given order (used where the order carries meaning, e.g.
 * cut shapes must release inner cutouts before the outermost outline) but still
 * orient each path for the shortest entry from the previous one.
 */
function orientInOrder(ops: PathOp[], start: Vec2): { ops: PathOp[]; end: Vec2 } {
  const result: PathOp[] = [];
  let cur = start;
  for (const op of ops) {
    const entry = entryFor(op, cur);
    result.push({ ...op, points: entry.points });
    cur = endOf(entry.points);
  }
  return { ops: result, end: cur };
}

/**
 * Build the full job toolpath. Machining phases keep their engraving-first
 * order (text → symbols → engrave shapes → cuts), but within each phase the
 * paths are reordered and oriented to minimise rapid travel, and successive
 * phases chain from where the previous one finished. Cut shapes keep their
 * area-sorted order for correctness and are only re-oriented, never reordered.
 */
export function buildToolpath(opts: ToolpathOptions): PathOp[] {
  const { label, profile, originX, originY } = opts;
  const part = partBBox(label);
  const ordered = orderElements(label.elements);

  const opsFor = (el: Element): PathOp[] => {
    const depth = elementDepth(el, profile);
    // Bold text is thickened with a fill pattern: the centreline plus parallel
    // passes that widen the stroke using the element's own bit — no tool change.
    const bold = resolveBoldFill(el, profile);
    const cut = isCutShape(el);

    const machineStrokes = elementStrokes(el)
      .filter((stroke) => stroke.length >= 2)
      .map((stroke) => stroke.map((p) => partToMachine(p, part, originX, originY)));

    // Weld strokes that meet end-to-end (e.g. the four diagonals of a "W") into
    // continuous paths so each glyph engraves in a single pen-down instead of
    // lifting at every shared corner. Bold text is left unwelded: its parallel
    // fill passes use a clamped miter that would spike at the sharp interior
    // corners welding introduces, so its short strokes overlap at corners instead
    // (and bold already plunges per pass, so welding the centreline saves little).
    const paths = bold ? machineStrokes : chainStrokes(machineStrokes);

    const out: PathOp[] = [];
    let first = true;
    for (const stroke of paths) {
      for (const points of strokePasses(stroke, bold)) {
        if (points.length < 2) continue;
        out.push({ points, depth, cut, comment: first ? describeElement(el) : undefined });
        first = false;
      }
    }
    return out;
  };

  const collect = (predicate: (el: Element) => boolean): PathOp[] =>
    ordered.filter(predicate).flatMap(opsFor);

  // Engraving phases may be freely reordered for travel; the cut phase keeps its
  // area order so inner cutouts release before the part outline.
  const engravePhases = [
    collect((e) => e.type === 'text'),
    collect((e) => e.type === 'symbol'),
    collect((e) => e.type === 'shape' && e.mode === 'engrave'),
  ];
  const cutOps = ordered.filter(isCutShape).flatMap(opsFor);

  const ops: PathOp[] = [];
  let cur: Vec2 = { x: originX, y: originY };
  for (const phase of engravePhases) {
    if (phase.length === 0) continue;
    const optimized = optimizeTravel(phase, cur);
    ops.push(...optimized.ops);
    cur = optimized.end;
  }
  if (cutOps.length > 0) {
    const oriented = orientInOrder(cutOps, cur);
    ops.push(...oriented.ops);
  }
  return ops;
}
