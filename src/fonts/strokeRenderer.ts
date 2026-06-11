import type { FontDef, Stroke } from './types';
import type { Vec2 } from '../utils/geometry';
import { normalize, perp } from '../utils/geometry';

export type Polyline = Vec2[];

export interface TextLayout {
  /** Polylines in mm, relative to the text block's top-left corner. */
  strokes: Polyline[];
  width: number;
  height: number;
}

export type TextAlign = 'left' | 'centre' | 'right';

const FALLBACK_CHAR = '?';

function glyphFor(font: FontDef, ch: string) {
  const glyph = font.glyphs[ch];
  if (glyph) return glyph;
  if (ch !== FALLBACK_CHAR) {
    console.warn(`Font "${font.name}": missing glyph for "${ch}", rendering "${FALLBACK_CHAR}"`);
  }
  return font.glyphs[FALLBACK_CHAR] ?? { strokes: [], advanceWidth: font.defaultAdvanceWidth };
}

function lineWidth(line: string, font: FontDef, scale: number): number {
  let w = 0;
  for (const ch of line) w += glyphFor(font, ch).advanceWidth * scale;
  return w;
}

/**
 * Lay out multi-line text as mm polylines relative to the block top-left.
 * fontSize is the cap height in mm; lineSpacing is the gap between lines in mm.
 */
export function layoutText(
  text: string,
  font: FontDef,
  fontSize: number,
  lineSpacing: number,
  align: TextAlign,
): TextLayout {
  const scale = fontSize / font.capHeight;
  const lines = text.split('\n');
  const widths = lines.map((l) => lineWidth(l, font, scale));
  const blockWidth = Math.max(0, ...widths);
  const blockHeight = lines.length * fontSize + (lines.length - 1) * lineSpacing;

  const strokes: Polyline[] = [];
  lines.forEach((line, i) => {
    const yOffset = i * (fontSize + lineSpacing);
    let xOffset =
      align === 'centre' ? (blockWidth - widths[i]) / 2 : align === 'right' ? blockWidth - widths[i] : 0;
    for (const ch of line) {
      const glyph = glyphFor(font, ch);
      for (const stroke of glyph.strokes) {
        strokes.push(stroke.map(([x, y]) => ({ x: xOffset + x * scale, y: yOffset + y * scale })));
      }
      xOffset += glyph.advanceWidth * scale;
    }
  });

  return { strokes, width: blockWidth, height: blockHeight };
}

/** Scale normalised symbol strokes (0–1 square) to a width × height mm box. */
export function scaleStrokes(strokes: Stroke[], width: number, height: number): Polyline[] {
  return strokes.map((s) => s.map(([x, y]) => ({ x: x * width, y: y * height })));
}

/**
 * Expand a polyline into `passCount` laterally offset copies spaced `passSpacing`
 * mm apart, centred on the original. Pass 1 returns the original unchanged.
 */
export function expandMultiPass(stroke: Polyline, passCount: number, passSpacing: number): Polyline[] {
  if (passCount <= 1 || stroke.length < 2) return [stroke];

  // Per-vertex offset directions: average of adjacent segment normals.
  const normals: Vec2[] = stroke.map((_, i) => {
    const prev = stroke[Math.max(0, i - 1)];
    const next = stroke[Math.min(stroke.length - 1, i + 1)];
    return normalize(perp({ x: next.x - prev.x, y: next.y - prev.y }));
  });

  const passes: Polyline[] = [];
  for (let k = 0; k < passCount; k++) {
    const offset = (k - (passCount - 1) / 2) * passSpacing;
    passes.push(stroke.map((p, i) => ({ x: p.x + normals[i].x * offset, y: p.y + normals[i].y * offset })));
  }
  return passes;
}
