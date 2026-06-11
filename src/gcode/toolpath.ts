import type { Element, Label } from '../elements/types';
import type { MachineProfile } from '../machineProfiles/types';
import { textElementStrokes } from '../elements/TextElement';
import { symbolElementStrokes } from '../elements/SymbolElement';
import { borderElementStrokes } from '../elements/BorderElement';
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

function elementDepth(el: Element, profile: MachineProfile): number {
  if (el.type === 'border') {
    // The border is the freeing cut: default depth is full material thickness.
    return el.engraveDepth ?? profile.materialThickness;
  }
  return el.engraveDepth ?? profile.engraveDepth;
}

function elementStrokes(el: Element, label: Label, profile: MachineProfile): Polyline[] {
  switch (el.type) {
    case 'text':
      return textElementStrokes(el);
    case 'symbol':
      return symbolElementStrokes(el);
    case 'border':
      return borderElementStrokes(el, label, profile.toolDiameter);
  }
}

function describeElement(el: Element): string {
  switch (el.type) {
    case 'text':
      return `text "${el.text.split('\n')[0].slice(0, 30)}"`;
    case 'symbol':
      return `symbol ${el.symbolName}`;
    case 'border':
      return 'border (final cut)';
  }
}

/**
 * Build the full job toolpath with engraving-first ordering strictly enforced:
 * text → symbols → any other non-border elements → border LAST.
 * This ordering is not configurable: the border cut frees the label from the
 * stock sheet, so it must never run before engraving.
 */
export function buildToolpath(opts: ToolpathOptions): PathOp[] {
  const { label, profile, originX, originY } = opts;
  const texts = label.elements.filter((e) => e.type === 'text');
  const symbols = label.elements.filter((e) => e.type === 'symbol');
  const others = label.elements.filter((e) => e.type !== 'text' && e.type !== 'symbol' && e.type !== 'border');
  const borders = label.elements.filter((e) => e.type === 'border');
  const ordered: Element[] = [...texts, ...symbols, ...others, ...borders];

  const ops: PathOp[] = [];
  for (const el of ordered) {
    const depth = elementDepth(el, profile);
    const strokes = elementStrokes(el, label, profile);
    strokes.forEach((stroke, i) => {
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
