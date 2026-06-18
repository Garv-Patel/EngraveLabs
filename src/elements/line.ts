import type { Element, ShapeElement } from './types';
import type { Vec2 } from '../utils/geometry';

export type LineElement = ShapeElement & { shapeKind: 'line' };

export function isLine(el: Element): el is LineElement {
  return el.type === 'shape' && el.shapeKind === 'line';
}

/**
 * The two endpoints of a line, in label space (mm). The segment runs along one
 * diagonal of the bbox; `lineFlipped` selects which one.
 */
export function lineEndpoints(el: LineElement): [Vec2, Vec2] {
  if (el.lineFlipped) {
    return [
      { x: el.x, y: el.y + el.height },
      { x: el.x + el.width, y: el.y },
    ];
  }
  return [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y + el.height },
  ];
}

/** Derive bbox + diagonal flag from two endpoints. */
export function lineBoxFromEndpoints(
  a: Vec2,
  b: Vec2,
): Pick<ShapeElement, 'x' | 'y' | 'width' | 'height' | 'lineFlipped'> {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
    lineFlipped: (b.x - a.x) * (b.y - a.y) < 0,
  };
}
