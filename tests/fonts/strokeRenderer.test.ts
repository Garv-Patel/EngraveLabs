import { describe, it, expect } from 'vitest';
import { layoutText } from '../../src/fonts/strokeRenderer';
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
