import type { TextElement } from './types';
import { getFont } from '../fonts/fontRegistry';
import { layoutText, type Polyline } from '../fonts/strokeRenderer';
import { rotateAround, type Vec2 } from '../utils/geometry';

/** Stroke width as a fraction of cap height when "proportional" is on. */
export const TEXT_THICKNESS_RATIO = 0.12;

type ThicknessInput = Pick<TextElement, 'fontSize' | 'thickness' | 'thicknessAuto'>;

/** The requested stroke width in mm (0 = hairline), before clamping to the bit. */
export function textThicknessTargetMm(el: ThicknessInput): number {
  if (el.thicknessAuto) return el.fontSize * TEXT_THICKNESS_RATIO;
  return el.thickness ?? 0;
}

/** Actual engraved stroke width: never thinner than the bit that cuts it. */
export function effectiveTextThicknessMm(el: ThicknessInput, toolDiameter: number): number {
  const target = textThicknessTargetMm(el);
  return target > toolDiameter ? target : toolDiameter;
}

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
 * with rotation applied. Engraved line width comes from the chosen bit, so the
 * centreline is machined once — no faked thickness from parallel passes.
 */
export function textElementStrokes(el: TextElement): Polyline[] {
  const font = getFont(el.fontName);
  if (!font) return [];
  const layout = layoutText(el.text, font, el.fontSize, el.lineSpacing, el.align);
  const centre: Vec2 = { x: el.x + el.width / 2, y: el.y + el.height / 2 };

  return layout.strokes.map((stroke) => {
    const placed = stroke.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    return el.rotation ? placed.map((p) => rotateAround(p, centre, el.rotation)) : placed;
  });
}
