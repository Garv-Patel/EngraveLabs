export interface BaseElement {
  id: string; // UUID
  x: number; // mm from label top-left
  y: number; // mm from label top-left
  width: number; // mm bounding box width
  height: number; // mm bounding box height
  rotation: number; // degrees
  locked: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontName: string; // e.g. "hershey_simplex"
  fontSize: number; // mm cap height
  passCount: number; // 1 = single stroke; N = N parallel offset passes
  passSpacing: number; // mm between passes (multi-pass mode)
  lineSpacing: number; // mm between lines
  align: 'left' | 'centre' | 'right';
  engraveDepth: number | null; // null = use machine profile default
}

export interface SymbolElement extends BaseElement {
  type: 'symbol';
  symbolName: string; // key in symbol registry
  passCount: number;
  engraveDepth: number | null;
}

export interface BorderElement extends BaseElement {
  type: 'border';
  lineThickness: number; // mm — rendered as inset parallel passes
  cornerRadius: number; // mm — 0 = sharp corners
  engraveDepth: number | null;
  // cut order is always LAST; enforced by the generator, not a user setting
}

export type Element = TextElement | SymbolElement | BorderElement;

export interface Label {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  elements: Element[];
  backgroundColor: string; // canvas preview only — not in G-code
}
