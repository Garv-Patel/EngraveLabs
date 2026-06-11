import { describe, it, expect } from 'vitest';
import { layoutText, expandMultiPass } from '../../src/fonts/strokeRenderer';
import { getFont } from '../../src/fonts/fontRegistry';

const font = getFont('hershey_simplex')!;

describe('layoutText', () => {
  it('scales a capital letter to the requested cap height', () => {
    const layout = layoutText('I', font, 10, 2, 'left');
    const ys = layout.strokes.flat().map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(10, 1);
  });

  it('lays out multiple lines with line spacing', () => {
    const layout = layoutText('A\nB', font, 6, 2, 'left');
    expect(layout.height).toBeCloseTo(6 + 2 + 6);
  });

  it('right-aligns shorter lines', () => {
    const layout = layoutText('III\nI', font, 6, 2, 'right');
    // Second line's strokes should start further right than first line's left edge
    const line2 = layout.strokes[layout.strokes.length - 1];
    expect(Math.min(...line2.map((p) => p.x))).toBeGreaterThan(0);
  });

  it('renders missing glyphs as "?"', () => {
    const q = layoutText('?', font, 6, 2, 'left');
    const missing = layoutText('¿', font, 6, 2, 'left'); // not in font
    expect(missing.strokes.length).toBe(q.strokes.length);
  });

  it('advances the cursor between characters', () => {
    const one = layoutText('A', font, 6, 2, 'left');
    const two = layoutText('AA', font, 6, 2, 'left');
    expect(two.width).toBeCloseTo(one.width * 2, 5);
  });
});

describe('expandMultiPass', () => {
  const stroke = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ];

  it('returns the original stroke for passCount 1', () => {
    expect(expandMultiPass(stroke, 1, 0.2)).toEqual([stroke]);
  });

  it('creates N offset copies centred on the original', () => {
    const passes = expandMultiPass(stroke, 3, 0.2);
    expect(passes).toHaveLength(3);
    const offsets = passes.map((p) => p[0].y).sort((a, b) => a - b);
    expect(offsets[0]).toBeCloseTo(-0.2);
    expect(offsets[1]).toBeCloseTo(0);
    expect(offsets[2]).toBeCloseTo(0.2);
  });

  it('offsets perpendicular to the stroke direction', () => {
    const vertical = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ];
    const passes = expandMultiPass(vertical, 2, 0.3);
    expect(Math.abs(passes[0][0].x - passes[1][0].x)).toBeCloseTo(0.3);
    expect(passes[0][0].y).toBeCloseTo(0);
  });
});
