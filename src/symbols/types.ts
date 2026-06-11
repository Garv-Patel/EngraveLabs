import type { Stroke } from '../fonts/types';

export interface SymbolDef {
  name: string;
  displayName: string;
  /** Polylines in 0–1 space (square bounding box). */
  strokes: Stroke[];
}
