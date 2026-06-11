import type { SymbolDef } from '../types';

/** IEC/AS-style hazard warning triangle with exclamation mark. */
export const warning: SymbolDef = {
  name: 'warning',
  displayName: 'Warning triangle',
  strokes: [
    // Equilateral-ish triangle outline
    [
      [0.5, 0.02],
      [0.98, 0.95],
      [0.02, 0.95],
      [0.5, 0.02],
    ],
    // Exclamation bar
    [
      [0.5, 0.32],
      [0.5, 0.68],
    ],
    // Exclamation dot (tiny square)
    [
      [0.48, 0.8],
      [0.52, 0.8],
      [0.52, 0.84],
      [0.48, 0.84],
      [0.48, 0.8],
    ],
  ],
};
