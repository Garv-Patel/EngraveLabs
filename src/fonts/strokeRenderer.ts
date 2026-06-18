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
 * Fill a single-line stroke to `totalWidth` mm by machining overlapping passes
 * with a `toolDiameter` cutter. Passes are spaced ~0.6× the tool diameter so
 * they overlap and clear the band cleanly (no gaps); the result is a solid
 * stroke `totalWidth` wide. Returns the original stroke when the requested
 * width is no wider than the tool (a single centreline pass).
 */
export function widenStroke(stroke: Polyline, totalWidth: number, toolDiameter: number): Polyline[] {
  if (stroke.length < 2 || totalWidth <= toolDiameter) return [stroke];
  const band = (totalWidth - toolDiameter) / 2; // furthest offset from the centreline
  const stepover = Math.max(0.01, toolDiameter * 0.6);
  const half = Math.max(1, Math.ceil(band / stepover));

  // Per-vertex offset directions: average of adjacent segment normals.
  const normals: Vec2[] = stroke.map((_, i) => {
    const prev = stroke[Math.max(0, i - 1)];
    const next = stroke[Math.min(stroke.length - 1, i + 1)];
    return normalize(perp({ x: next.x - prev.x, y: next.y - prev.y }));
  });

  // Centreline first, then walk outwards symmetrically.
  const passes: Polyline[] = [stroke];
  for (let k = 1; k <= half; k++) {
    const offset = (k / half) * band;
    for (const sign of [1, -1]) {
      passes.push(stroke.map((p, i) => ({ x: p.x + normals[i].x * offset * sign, y: p.y + normals[i].y * offset * sign })));
    }
  }
  return passes;
}
