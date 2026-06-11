import type { Element, Label, ShapeElement } from '../elements/types';
import type { MachineProfile } from '../machineProfiles/types';
import { textElementStrokes } from '../elements/TextElement';
import { symbolElementStrokes } from '../elements/SymbolElement';
import { shapeElementStrokes } from '../elements/ShapeElement';
import type { Polyline } from '../fonts/strokeRenderer';
import type { Vec2 } from '../utils/geometry';

/** One continuous engraving path at a single depth, in machine coordinates (y-up). */
export interface PathOp {
  points: Vec2[];
  depth: number; // mm below material surface (positive value)
  comment?: string;
}

export interface ToolpathOptions {
  label: Label;
  profile: MachineProfile;
  /** mm offset of the label's bottom-left corner on the machine bed. */
  originX: number;
  originY: number;
}

/** Label space (mm, y-down from label top-left) → machine space (mm, y-up). */
export function labelToMachine(p: Vec2, label: Label, originX: number, originY: number): Vec2 {
  return { x: originX + p.x, y: originY + (label.height - p.y) };
}

export function isCutShape(el: Element): el is ShapeElement {
  return el.type === 'shape' && el.mode === 'cut';
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
  const ops: PathOp[] = [];
  for (const el of orderElements(label.elements)) {
    const depth = elementDepth(el, profile);
    elementStrokes(el).forEach((stroke, i) => {
      if (stroke.length < 2) return;
      ops.push({
        points: stroke.map((p) => labelToMachine(p, label, originX, originY)),
        depth,
        comment: i === 0 ? describeElement(el) : undefined,
      });
    });
  }
  return ops;
}
