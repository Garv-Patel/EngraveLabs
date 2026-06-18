import type { Element } from '../elements/types';
import type { BBox, Vec2 } from '../utils/geometry';
import { pointInBBox, rotateAround, bboxCentre, bboxesIntersect, distanceToSegment } from '../utils/geometry';
import { isLine, lineEndpoints } from '../elements/line';
import type { HandleId } from './handles';

/** Pick tolerance for thin elements (lines), in mm. */
const LINE_HIT_TOLERANCE_MM = 1.2;

export function elementBBox(el: Element): BBox {
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

/** Hit-test a label-space point against an element, respecting rotation. */
export function hitTestElement(point: Vec2, el: Element): boolean {
  if (isLine(el)) {
    const [a, b] = lineEndpoints(el);
    return distanceToSegment(point, a, b) <= LINE_HIT_TOLERANCE_MM;
  }
  const bbox = elementBBox(el);
  const local = el.rotation ? rotateAround(point, bboxCentre(bbox), -el.rotation) : point;
  return pointInBBox(local, bbox);
}

/**
 * Element to select under a point. When several overlap, the smallest one wins
 * so a small object sitting on top of (or inside) a larger shape stays grabbable
 * — otherwise the big background shape always swallows the click. Ties break to
 * the topmost (last drawn).
 */
export function elementAtPoint(point: Vec2, elements: Element[]): Element | null {
  let best: Element | null = null;
  let bestArea = Infinity;
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!hitTestElement(point, el)) continue;
    const area = isLine(el) ? 0 : el.width * el.height;
    if (area < bestArea) {
      best = el;
      bestArea = area;
    }
  }
  return best;
}

export function elementsInRect(rect: BBox, elements: Element[]): Element[] {
  return elements.filter((el) => bboxesIntersect(rect, elementBBox(el)));
}

export interface ResizeInput {
  start: BBox;
  handle: HandleId;
  /** Pointer delta in label-space mm (already un-rotated for rotated elements). */
  dx: number;
  dy: number;
  /** Keep aspect ratio (Shift, or symbol default). */
  proportional: boolean;
  minSize: number;
}

/** New bbox after dragging a resize handle. */
export function resizeBBox({ start, handle, dx, dy, proportional, minSize }: ResizeInput): BBox {
  let { x, y, width, height } = start;
  const west = handle.includes('w');
  const north = handle.includes('n');
  const east = handle.includes('e');
  const south = handle.includes('s');

  if (east) width = start.width + dx;
  if (south) height = start.height + dy;
  if (west) {
    width = start.width - dx;
    x = start.x + dx;
  }
  if (north) {
    height = start.height - dy;
    y = start.y + dy;
  }

  if (proportional && start.width > 0 && start.height > 0) {
    const ratio = start.width / start.height;
    const isCorner = (east || west) && (north || south);
    if (isCorner || east || west) {
      const newHeight = width / ratio;
      if (north) y += height - newHeight;
      height = newHeight;
    } else {
      const newWidth = height * ratio;
      if (west) x += width - newWidth;
      width = newWidth;
    }
  }

  if (width < minSize) {
    if (west) x -= minSize - width;
    width = minSize;
  }
  if (height < minSize) {
    if (north) y -= minSize - height;
    height = minSize;
  }
  return { x, y, width, height };
}

/** Rotation angle (degrees) of the pointer around a centre, 0° pointing up. */
export function rotationFromPointer(centre: Vec2, pointer: Vec2): number {
  const deg = (Math.atan2(pointer.y - centre.y, pointer.x - centre.x) * 180) / Math.PI + 90;
  return ((deg % 360) + 360) % 360;
}
