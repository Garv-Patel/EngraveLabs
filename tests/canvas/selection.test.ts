import { describe, it, expect } from 'vitest';
import { elementAtPoint } from '../../src/canvas/interaction';
import type { Element, ShapeElement } from '../../src/elements/types';

function rect(id: string, x: number, y: number, w: number, h: number, mode: 'engrave' | 'cut' = 'engrave'): ShapeElement {
  return {
    id,
    type: 'shape',
    shapeKind: 'rectangle',
    mode,
    cornerRadius: 0,
    engraveDepth: null,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    locked: false,
  };
}

describe('elementAtPoint', () => {
  it('selects the smaller element when a small one sits on a larger one', () => {
    // Big outline drawn first, small shape inside it drawn later.
    const big = rect('big', 0, 0, 100, 50, 'cut');
    const small = rect('small', 40, 20, 10, 10);
    const els: Element[] = [big, small];
    // Click inside the small shape (also inside the big one).
    expect(elementAtPoint({ x: 45, y: 25 }, els)?.id).toBe('small');
    // Click where only the big one is present.
    expect(elementAtPoint({ x: 5, y: 5 }, els)?.id).toBe('big');
  });

  it('still selects the smaller even when the larger is drawn on top', () => {
    const small = rect('small', 40, 20, 10, 10);
    const big = rect('big', 0, 0, 100, 50);
    expect(elementAtPoint({ x: 45, y: 25 }, [small, big])?.id).toBe('small');
  });

  it('returns null when nothing is hit', () => {
    expect(elementAtPoint({ x: 200, y: 200 }, [rect('a', 0, 0, 10, 10)])).toBeNull();
  });
});
