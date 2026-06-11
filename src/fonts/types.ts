/** A polyline in normalised glyph space: y = 0 at cap top, y = capHeight at baseline. */
export type Stroke = [number, number][];

export interface GlyphDef {
  /** List of polylines in normalised 0–1 space. */
  strokes: Stroke[];
  /** Normalised advance for spacing. */
  advanceWidth: number;
}

export interface FontDef {
  name: string;
  glyphs: Record<string, GlyphDef>;
  defaultAdvanceWidth: number;
  /** Normalised cap height (used to scale to fontSize). */
  capHeight: number;
}
