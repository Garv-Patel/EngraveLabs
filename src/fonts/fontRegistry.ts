import type { FontDef } from './types';
import hersheySimplex from './data/hersheySimplexFont.json';
import hersheyRoman from './data/hersheyRomanFont.json';

const fonts = new Map<string, FontDef>();

export function registerFont(id: string, font: FontDef): void {
  fonts.set(id, font);
}

export function getFont(id: string): FontDef | undefined {
  return fonts.get(id);
}

export function listFonts(): { id: string; name: string }[] {
  return [...fonts.entries()].map(([id, f]) => ({ id, name: f.name }));
}

registerFont('hershey_simplex', hersheySimplex as unknown as FontDef);
registerFont('hershey_roman', hersheyRoman as unknown as FontDef);

export const DEFAULT_FONT_ID = 'hershey_simplex';
