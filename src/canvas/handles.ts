import type { BBox, Vec2 } from '../utils/geometry';
import { rotateAround, bboxCentre } from '../utils/geometry';
import { lineEndpoints, type LineElement } from '../elements/line';

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot' | 'lineA' | 'lineB';

export const HANDLE_SIZE_PX = 8; // constant screen size, independent of zoom
export const ROTATION_HANDLE_OFFSET_PX = 24; // distance above the top-centre handle

export interface HandlePosition {
  id: HandleId;
  /** Centre of the handle in screen px. */
  point: Vec2;
}

/**
 * Handle positions for an element bbox, in screen px. `toScreen` converts a
 * world (mm) point to screen px. Rotation is applied around the bbox centre.
 */
export function handlePositions(
  bbox: BBox,
  rotation: number,
  toScreen: (p: Vec2) => Vec2,
): HandlePosition[] {
  const { x, y, width: w, height: h } = bbox;
  const centre = bboxCentre(bbox);
  type BoxHandleId = Exclude<HandleId, 'rot' | 'lineA' | 'lineB'>;
  const world: Record<BoxHandleId, Vec2> = {
    nw: { x, y },
    n: { x: x + w / 2, y },
    ne: { x: x + w, y },
    e: { x: x + w, y: y + h / 2 },
    se: { x: x + w, y: y + h },
    s: { x: x + w / 2, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: y + h / 2 },
  };
  const positions: HandlePosition[] = (Object.keys(world) as BoxHandleId[]).map((id) => ({
    id,
    point: toScreen(rotation ? rotateAround(world[id], centre, rotation) : world[id]),
  }));

  // Rotation handle: fixed px offset above the (rotated) top-centre handle.
  const n = positions.find((p) => p.id === 'n')!.point;
  const c = toScreen(centre);
  const dir = { x: n.x - c.x, y: n.y - c.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  positions.push({
    id: 'rot',
    point: {
      x: n.x + (dir.x / len) * ROTATION_HANDLE_OFFSET_PX,
      y: n.y + (dir.y / len) * ROTATION_HANDLE_OFFSET_PX,
    },
  });
  return positions;
}

/** The two draggable endpoint handles of a line, in screen px. */
export function lineHandlePositions(el: LineElement, toScreen: (p: Vec2) => Vec2): HandlePosition[] {
  const [a, b] = lineEndpoints(el);
  return [
    { id: 'lineA', point: toScreen(a) },
    { id: 'lineB', point: toScreen(b) },
  ];
}

/** Hit-test a screen point against handles; returns the handle id or null. */
export function hitTestHandles(screenPoint: Vec2, handles: HandlePosition[]): HandleId | null {
  const r = HANDLE_SIZE_PX / 2 + 3; // small grace zone
  for (const h of handles) {
    if (Math.abs(screenPoint.x - h.point.x) <= r && Math.abs(screenPoint.y - h.point.y) <= r) {
      return h.id;
    }
  }
  return null;
}

export function cursorForHandle(id: HandleId): string {
  switch (id) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'rot':
      return 'grab';
    case 'lineA':
    case 'lineB':
      return 'move';
  }
}
