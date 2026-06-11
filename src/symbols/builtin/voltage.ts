import type { SymbolDef } from '../types';

/** Lightning bolt — live electrical / voltage hazard. */
export const voltage: SymbolDef = {
  name: 'voltage',
  displayName: 'Lightning bolt',
  strokes: [
    [
      [0.62, 0.02],
      [0.28, 0.45],
      [0.5, 0.45],
      [0.38, 0.98],
      [0.72, 0.42],
      [0.5, 0.42],
      [0.62, 0.02],
    ],
    // Arrowhead at the tip
    [
      [0.38, 0.98],
      [0.3, 0.78],
    ],
    [
      [0.38, 0.98],
      [0.55, 0.85],
    ],
  ],
};
