import type { SymbolDef } from '../types';
import type { Stroke } from '../../fonts/types';

const round = (n: number) => Math.round(n * 1000) / 1000;

function circle(cx: number, cy: number, r: number, segments = 32): Stroke {
  const pts: Stroke = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))]);
  }
  return pts;
}

/** Sine wave from x0 to x1 centred on cy, one full period. */
function sine(x0: number, x1: number, cy: number, amp: number, samples = 24): Stroke {
  const pts: Stroke = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    pts.push([round(x0 + (x1 - x0) * t), round(cy - amp * Math.sin(t * Math.PI * 2))]);
  }
  return pts;
}

/** Protective earth / ground. */
export const earth: SymbolDef = {
  name: 'earth',
  displayName: 'Earth / ground',
  strokes: [
    [[0.5, 0.08], [0.5, 0.5]],
    [[0.2, 0.5], [0.8, 0.5]],
    [[0.3, 0.66], [0.7, 0.66]],
    [[0.4, 0.82], [0.6, 0.82]],
  ],
};

/** IEC fuse: rectangle with a line through its length. */
export const fuse: SymbolDef = {
  name: 'fuse',
  displayName: 'Fuse',
  strokes: [
    [[0.5, 0.05], [0.5, 0.22]],
    [[0.5, 0.78], [0.5, 0.95]],
    [[0.35, 0.22], [0.65, 0.22], [0.65, 0.78], [0.35, 0.78], [0.35, 0.22]],
    [[0.5, 0.22], [0.5, 0.78]],
  ],
};

/** IEC resistor: rectangle with axial leads. */
export const resistor: SymbolDef = {
  name: 'resistor',
  displayName: 'Resistor',
  strokes: [
    [[0.05, 0.5], [0.25, 0.5]],
    [[0.75, 0.5], [0.95, 0.5]],
    [[0.25, 0.36], [0.75, 0.36], [0.75, 0.64], [0.25, 0.64], [0.25, 0.36]],
  ],
};

/** Lamp / signal light: crossed circle. */
export const lamp: SymbolDef = {
  name: 'lamp',
  displayName: 'Lamp',
  strokes: [
    circle(0.5, 0.5, 0.28),
    [[0.3, 0.3], [0.7, 0.7]],
    [[0.7, 0.3], [0.3, 0.7]],
    [[0.05, 0.5], [0.22, 0.5]],
    [[0.78, 0.5], [0.95, 0.5]],
  ],
};

/** Diode: triangle pointing at a cathode bar. */
export const diode: SymbolDef = {
  name: 'diode',
  displayName: 'Diode',
  strokes: [
    [[0.05, 0.5], [0.3, 0.5]],
    [[0.7, 0.5], [0.95, 0.5]],
    [[0.3, 0.3], [0.7, 0.5], [0.3, 0.7], [0.3, 0.3]],
    [[0.7, 0.3], [0.7, 0.7]],
  ],
};

/** Battery / DC source: one cell, long + short plates. */
export const battery: SymbolDef = {
  name: 'battery',
  displayName: 'Battery',
  strokes: [
    [[0.5, 0.1], [0.5, 0.38]],
    [[0.5, 0.62], [0.5, 0.9]],
    [[0.22, 0.38], [0.78, 0.38]],
    [[0.37, 0.62], [0.63, 0.62]],
  ],
};

/** AC source: circle with a sine wave. */
export const acSource: SymbolDef = {
  name: 'ac_source',
  displayName: 'AC source',
  strokes: [circle(0.5, 0.5, 0.4), sine(0.28, 0.72, 0.5, 0.16)],
};

/** SPST switch (open). */
export const switchSpst: SymbolDef = {
  name: 'switch',
  displayName: 'Switch (SPST)',
  strokes: [
    [[0.05, 0.62], [0.3, 0.62]],
    [[0.7, 0.62], [0.95, 0.62]],
    circle(0.3, 0.62, 0.03, 12),
    circle(0.7, 0.62, 0.03, 12),
    [[0.3, 0.62], [0.66, 0.4]],
  ],
};

export const electricalSymbols: SymbolDef[] = [
  earth,
  fuse,
  resistor,
  lamp,
  diode,
  battery,
  acSource,
  switchSpst,
];
