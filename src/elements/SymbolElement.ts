import type { SymbolElement } from './types';
import { getSymbol } from '../symbols/symbolRegistry';
import { scaleStrokes, expandMultiPass, type Polyline } from '../fonts/strokeRenderer';
import { rotateAround, type Vec2 } from '../utils/geometry';

/** Multi-pass spacing for symbols follows the machine's typical tool width. */
const SYMBOL_PASS_SPACING = 0.2;

/** Strokes for a symbol element in label space (mm, y-down from label top-left). */
export function symbolElementStrokes(el: SymbolElement): Polyline[] {
  const symbol = getSymbol(el.symbolName);
  if (!symbol) return [];
  const centre: Vec2 = { x: el.x + el.width / 2, y: el.y + el.height / 2 };

  const out: Polyline[] = [];
  for (const stroke of scaleStrokes(symbol.strokes, el.width, el.height)) {
    const placed = stroke.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    for (const pass of expandMultiPass(placed, el.passCount, SYMBOL_PASS_SPACING)) {
      out.push(el.rotation ? pass.map((p) => rotateAround(p, centre, el.rotation)) : pass);
    }
  }
  return out;
}
