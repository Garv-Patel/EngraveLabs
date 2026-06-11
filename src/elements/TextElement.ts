import type { TextElement } from './types';
import { getFont } from '../fonts/fontRegistry';
import { layoutText, expandMultiPass, type Polyline } from '../fonts/strokeRenderer';
import { rotateAround, type Vec2 } from '../utils/geometry';

/** Natural (unrotated) rendered size of a text element in mm. */
export function measureTextElement(el: Pick<TextElement, 'text' | 'fontName' | 'fontSize' | 'lineSpacing' | 'align'>): {
  width: number;
  height: number;
} {
  const font = getFont(el.fontName);
  if (!font) return { width: 0, height: 0 };
  const layout = layoutText(el.text, font, el.fontSize, el.lineSpacing, el.align);
  return { width: layout.width, height: layout.height };
}

/**
 * Strokes for a text element in label space (mm, y-down from label top-left),
 * with rotation and multi-pass expansion applied. Character stroke order is
 * preserved so multi-pass completes per character before moving on.
 */
export function textElementStrokes(el: TextElement): Polyline[] {
  const font = getFont(el.fontName);
  if (!font) return [];
  const layout = layoutText(el.text, font, el.fontSize, el.lineSpacing, el.align);
  const centre: Vec2 = { x: el.x + el.width / 2, y: el.y + el.height / 2 };

  const out: Polyline[] = [];
  for (const stroke of layout.strokes) {
    const placed = stroke.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    for (const pass of expandMultiPass(placed, el.passCount, el.passSpacing)) {
      out.push(el.rotation ? pass.map((p) => rotateAround(p, centre, el.rotation)) : pass);
    }
  }
  return out;
}
