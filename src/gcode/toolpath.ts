import type { Element, Label, ShapeElement } from '../elements/types';
import type { MachineProfile } from '../machineProfiles/types';
import { textElementStrokes, effectiveTextThicknessMm } from '../elements/TextElement';
import { symbolElementStrokes } from '../elements/SymbolElement';
import { shapeElementStrokes } from '../elements/ShapeElement';
import { widenStroke, type Polyline } from '../fonts/strokeRenderer';
import { resolveBit } from '../machineProfiles/bits';
import type { BBox, Vec2 } from '../utils/geometry';

/** One continuous engraving path at a single depth, in machine coordinates (y-up). */
export interface PathOp {
  points: Vec2[];
  depth: number; // mm below material surface (positive value)
  comment?: string;
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

/**
 * Strokes actually machined for an element, accounting for the bit. Thick text
 * is filled to its stroke width with overlapping bit passes; everything else is
 * a single centreline pass.
 */
export function engraveStrokes(el: Element, profile: MachineProfile): Polyline[] {
  if (el.type === 'text') {
    const d = resolveBit(profile, el.bitId).diameter;
    const width = effectiveTextThicknessMm(el, d);
    const centrelines = textElementStrokes(el);
    if (width <= d) return centrelines;
    return centrelines.flatMap((s) => widenStroke(s, width, d));
  }
  return elementStrokes(el);
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

/** Build the full job toolpath with engraving-first ordering. */
export function buildToolpath(opts: ToolpathOptions): PathOp[] {
  const { label, profile, originX, originY } = opts;
  const part = partBBox(label);
  const ops: PathOp[] = [];
  for (const el of orderElements(label.elements)) {
    const depth = elementDepth(el, profile);
    engraveStrokes(el, profile).forEach((stroke, i) => {
      if (stroke.length < 2) return;
      ops.push({
        points: stroke.map((p) => partToMachine(p, part, originX, originY)),
        depth,
        comment: i === 0 ? describeElement(el) : undefined,
      });
    });
  }
  return ops;
}
