export interface BaseElement {
  id: string; // UUID
  x: number; // mm from label top-left
  y: number; // mm from label top-left
  width: number; // mm bounding box width
  height: number; // mm bounding box height
  rotation: number; // degrees
  locked: boolean;
  /** Cutter used for this element; null = the machine profile's default bit. */
  bitId?: string | null;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontName: string; // e.g. "hershey_simplex"
  fontSize: number; // mm cap height
  lineSpacing: number; // mm between lines
  align: 'left' | 'centre' | 'right';
  engraveDepth: number | null; // null = use machine profile default
}

export interface SymbolElement extends BaseElement {
  type: 'symbol';
  symbolName: string; // key in symbol registry
  engraveDepth: number | null;
}

// 'flash' is retained for backward compatibility only — the lightning glyph now
// lives in the symbol library. The shape tool offers geometric primitives only.
export type ShapeKind = 'rectangle' | 'circle' | 'triangle' | 'line' | 'flash';

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeKind: ShapeKind;
  /**
   * 'engrave' = surface marking at engrave depth.
   * 'cut' = through-cut at material thickness; always machined last
   * (innermost first), so custom label outlines free the part at the end.
   */
  mode: 'engrave' | 'cut';
  cornerRadius: number; // mm — rectangles only
  engraveDepth: number | null; // null = machine default (cut: material thickness)
  /**
   * Lines only. The segment runs between two opposite corners of the bbox:
   * false → top-left to bottom-right; true → bottom-left to top-right.
   * A line is defined by its two endpoints, not by a filled rectangle.
   */
  lineFlipped?: boolean;
}

export type Element = TextElement | SymbolElement | ShapeElement;

export interface Label {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  elements: Element[];
  backgroundColor: string; // canvas preview only — not in G-code
}
