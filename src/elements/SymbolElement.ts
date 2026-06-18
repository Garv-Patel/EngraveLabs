import type { SymbolElement } from './types';
import { getSymbol } from '../symbols/symbolRegistry';
import { scaleStrokes, type Polyline } from '../fonts/strokeRenderer';
import { rotateAround, type Vec2 } from '../utils/geometry';

/** Strokes for a symbol element in label space (mm, y-down from label top-left). */
export function symbolElementStrokes(el: SymbolElement): Polyline[] {
  const symbol = getSymbol(el.symbolName);
  if (!symbol) return [];
  const centre: Vec2 = { x: el.x + el.width / 2, y: el.y + el.height / 2 };

  return scaleStrokes(symbol.strokes, el.width, el.height).map((stroke) => {
    const placed = stroke.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    return el.rotation ? placed.map((p) => rotateAround(p, centre, el.rotation)) : placed;
  });
}
