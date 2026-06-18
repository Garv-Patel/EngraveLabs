import { describe, it, expect } from 'vitest';
import { isLine, lineEndpoints, lineBoxFromEndpoints } from '../../src/elements/line';
import { shapeElementStrokes } from '../../src/elements/ShapeElement';
import type { ShapeElement } from '../../src/elements/types';

function line(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: 'l1',
    type: 'shape',
    shapeKind: 'line',
    mode: 'engrave',
    cornerRadius: 0,
    engraveDepth: null,
    x: 0,
    y: 0,
    width: 10,
    height: 4,
    rotation: 0,
    locked: false,
    lineFlipped: false,
    ...overrides,
  };
}

describe('line element', () => {
  it('round-trips endpoints through bbox + flip', () => {
    const a = { x: 5, y: 8 };
    const b = { x: 1, y: 3 };
    const box = lineBoxFromEndpoints(a, b);
    const [ra, rb] = lineEndpoints({ ...line(), ...box } as ShapeElement & { shapeKind: 'line' });
    // Endpoints are returned left-to-right, but the segment is the same set.
    const set = [ra, rb].map((p) => `${p.x},${p.y}`).sort();
    expect(set).toEqual([a, b].map((p) => `${p.x},${p.y}`).sort());
  });

  it('uses the anti-diagonal when flipped', () => {
    const flipped = line({ lineFlipped: true });
    const [a, b] = lineEndpoints(flipped as ShapeElement & { shapeKind: 'line' });
    expect(a).toEqual({ x: 0, y: 4 });
    expect(b).toEqual({ x: 10, y: 0 });
  });

  it('renders a line as a single two-point segment, not a box', () => {
    const strokes = shapeElementStrokes(line());
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toHaveLength(2);
  });

  it('detects line shapes', () => {
    expect(isLine(line())).toBe(true);
    expect(isLine({ ...line(), shapeKind: 'rectangle' })).toBe(false);
  });
});
