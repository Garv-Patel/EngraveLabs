import type { BorderElement, Label } from './types';
import type { Polyline } from '../fonts/strokeRenderer';

const ARC_SEGMENTS_PER_CORNER = 8;

/** A closed rounded-rectangle polyline inset by `inset` mm from the label edge. */
function roundedRectPath(label: Label, inset: number, cornerRadius: number): Polyline {
  const x0 = inset;
  const y0 = inset;
  const x1 = label.width - inset;
  const y1 = label.height - inset;
  const r = Math.max(0, Math.min(cornerRadius - inset, (x1 - x0) / 2, (y1 - y0) / 2));

  if (r <= 0) {
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
      { x: x0, y: y0 },
    ];
  }

  const pts: Polyline = [];
  const corner = (cx: number, cy: number, startAngle: number) => {
    for (let i = 0; i <= ARC_SEGMENTS_PER_CORNER; i++) {
      const a = startAngle + (i / ARC_SEGMENTS_PER_CORNER) * (Math.PI / 2);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  };
  // Clockwise in y-down space, starting after the top-left corner.
  corner(x0 + r, y0 + r, Math.PI); // top-left: 180° → 270°
  corner(x1 - r, y0 + r, -Math.PI / 2); // top-right: 270° → 360°
  corner(x1 - r, y1 - r, 0); // bottom-right: 0° → 90°
  corner(x0 + r, y1 - r, Math.PI / 2); // bottom-left: 90° → 180°
  pts.push({ ...pts[0] });
  return pts;
}

/**
 * Strokes for the border in label space. The outermost pass follows the label
 * boundary (the cut that frees the label); lineThickness > toolDiameter adds
 * inward inset passes, cut inside-out so the boundary pass is always last.
 */
export function borderElementStrokes(el: BorderElement, label: Label, toolDiameter: number): Polyline[] {
  const step = Math.max(0.05, toolDiameter);
  const passCount = Math.max(1, Math.ceil(el.lineThickness / step));
  const passes: Polyline[] = [];
  for (let i = passCount - 1; i >= 0; i--) {
    passes.push(roundedRectPath(label, i * step, el.cornerRadius));
  }
  return passes;
}
