import type { SymbolDef } from '../types';
import type { Stroke } from '../../fonts/types';

function circle(cx: number, cy: number, r: number, segments = 36): Stroke {
  const pts: Stroke = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([
      Math.round((cx + r * Math.cos(a)) * 1000) / 1000,
      Math.round((cy + r * Math.sin(a)) * 1000) / 1000,
    ]);
  }
  return pts;
}

/** No-entry: circle with horizontal bar. */
export const noEntry: SymbolDef = {
  name: 'no_entry',
  displayName: 'No entry',
  strokes: [
    circle(0.5, 0.5, 0.48),
    [
      [0.18, 0.5],
      [0.82, 0.5],
    ],
  ],
};
