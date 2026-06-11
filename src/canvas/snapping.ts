import type { BBox } from '../utils/geometry';

export function snapToGrid(value: number, spacing: number): number {
  return Math.round(value / spacing) * spacing;
}

export interface AlignmentGuide {
  axis: 'x' | 'y';
  /** Position of the guide line in label-space mm. */
  position: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: AlignmentGuide[];
}

function axisCandidates(b: BBox, axis: 'x' | 'y'): number[] {
  return axis === 'x' ? [b.x, b.x + b.width / 2, b.x + b.width] : [b.y, b.y + b.height / 2, b.y + b.height];
}

/**
 * Compute alignment snapping for a dragged bbox against other element bboxes
 * and the label boundary. `threshold` is in mm (derive from 3px at current zoom).
 * Returns an additional (dx, dy) adjustment plus the guides to draw.
 */
export function computeAlignmentSnap(dragged: BBox, others: BBox[], threshold: number): SnapResult {
  const result: SnapResult = { dx: 0, dy: 0, guides: [] };

  for (const axis of ['x', 'y'] as const) {
    const own = axisCandidates(dragged, axis);
    let best: { delta: number; position: number } | null = null;
    for (const other of others) {
      for (const target of axisCandidates(other, axis)) {
        for (const o of own) {
          const delta = target - o;
          if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
            best = { delta, position: target };
          }
        }
      }
    }
    if (best) {
      if (axis === 'x') result.dx = best.delta;
      else result.dy = best.delta;
      result.guides.push({ axis, position: best.position });
    }
  }
  return result;
}
