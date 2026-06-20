import { add, distance, normalize, perp, scale, sub, type Vec2 } from '../utils/geometry';

/** Bold stroke width as a fraction of the text cap height. */
export const BOLD_STROKE_RATIO = 0.16;
/** Floor so small text still reads as bold rather than hairline. */
export const MIN_BOLD_WIDTH_MM = 0.6;

/** Target engraved width (mm) of a bold stroke for the given cap height. */
export function boldStrokeWidth(fontSize: number): number {
  return Math.max(MIN_BOLD_WIDTH_MM, fontSize * BOLD_STROKE_RATIO);
}

const CLOSED_EPS = 1e-6;
function isClosed(points: Vec2[]): boolean {
  return points.length >= 3 && distance(points[0], points[points.length - 1]) <= CLOSED_EPS;
}

/** Bisector offset direction at a vertex, with a clamped miter to avoid spikes. */
function miterDir(nPrev: Vec2, nNext: Vec2): Vec2 {
  const bis = normalize(add(nPrev, nNext));
  if (bis.x === 0 && bis.y === 0) return nNext; // ~180° reversal: degenerate
  const cos = Math.max(0.25, bis.x * nNext.x + bis.y * nNext.y);
  return scale(bis, 1 / cos);
}

/**
 * Offset an open or closed polyline by `dist` mm along its normals (one side per
 * sign). Each vertex moves along the bisector of its adjacent segment normals
 * with a clamped miter, and the vertex count is preserved so the offset stays a
 * single connected pass — keeping the travel optimiser happy.
 */
export function offsetPolyline(points: Vec2[], dist: number): Vec2[] {
  if (points.length < 2 || dist === 0) return points.map((p) => ({ ...p }));
  const closed = isClosed(points);
  const verts = closed ? points.slice(0, -1) : points; // drop duplicate closing vertex
  const m = verts.length;

  const segCount = closed ? m : m - 1;
  const segNormal: Vec2[] = [];
  for (let i = 0; i < segCount; i++) {
    segNormal.push(perp(normalize(sub(verts[(i + 1) % m], verts[i]))));
  }

  const out: Vec2[] = [];
  for (let i = 0; i < m; i++) {
    let dir: Vec2;
    if (closed) {
      dir = miterDir(segNormal[(i - 1 + m) % m], segNormal[i]);
    } else if (i === 0) {
      dir = segNormal[0];
    } else if (i === m - 1) {
      dir = segNormal[m - 2];
    } else {
      dir = miterDir(segNormal[i - 1], segNormal[i]);
    }
    out.push(add(verts[i], scale(dir, dist)));
  }
  if (closed) out.push({ ...out[0] });
  return out;
}

/**
 * Fill a stroke centreline out to `strokeWidth` mm using a tool of `bitDiameter`
 * mm, by laying parallel passes on both sides of the centreline. The centreline
 * is always included; when the bit already covers the width (or the path is
 * degenerate) only the centreline is returned. This is the "fill pattern" that
 * makes a stroke bold without a wider tool or a tool change.
 */
export function fillStroke(centreline: Vec2[], strokeWidth: number, bitDiameter: number): Vec2[][] {
  const passes: Vec2[][] = [centreline];
  // How far the outermost pass centre must sit from the centreline so its edge
  // reaches strokeWidth/2.
  const reach = strokeWidth / 2 - bitDiameter / 2;
  if (reach <= 1e-4 || centreline.length < 2) return passes;

  const stepover = Math.max(bitDiameter * 0.8, 1e-3); // overlap passes to avoid gaps
  const count = Math.ceil(reach / stepover);
  const step = reach / count; // even spacing out to the edge
  for (let k = 1; k <= count; k++) {
    const d = step * k;
    passes.push(offsetPolyline(centreline, d));
    passes.push(offsetPolyline(centreline, -d));
  }
  return passes;
}
