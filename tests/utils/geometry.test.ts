import { describe, it, expect } from 'vitest';
import {
  rotateAround,
  pointInBBox,
  bboxesIntersect,
  bboxContains,
  bboxOfPoints,
  clamp,
  distance,
} from '../../src/utils/geometry';
import { mmToDisplay, displayToMm } from '../../src/utils/units';
import { snapToGrid, computeAlignmentSnap } from '../../src/canvas/snapping';
import { resizeBBox } from '../../src/canvas/interaction';

describe('geometry', () => {
  it('rotateAround rotates 90° about a centre (y-down)', () => {
    const p = rotateAround({ x: 2, y: 1 }, { x: 1, y: 1 }, 90);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(2);
  });

  it('pointInBBox includes edges', () => {
    const b = { x: 0, y: 0, width: 10, height: 5 };
    expect(pointInBBox({ x: 0, y: 0 }, b)).toBe(true);
    expect(pointInBBox({ x: 10, y: 5 }, b)).toBe(true);
    expect(pointInBBox({ x: 10.01, y: 5 }, b)).toBe(false);
  });

  it('bbox intersection and containment', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(bboxesIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(bboxesIntersect(a, { x: 11, y: 0, width: 5, height: 5 })).toBe(false);
    expect(bboxContains(a, { x: 1, y: 1, width: 3, height: 3 })).toBe(true);
    expect(bboxContains(a, { x: 8, y: 8, width: 5, height: 5 })).toBe(false);
  });

  it('bboxOfPoints and helpers', () => {
    const b = bboxOfPoints([
      { x: 1, y: 2 },
      { x: 5, y: -1 },
    ]);
    expect(b).toEqual({ x: 1, y: -1, width: 4, height: 3 });
    expect(clamp(5, 0, 3)).toBe(3);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('units', () => {
  it('round-trips mm ↔ inches', () => {
    expect(mmToDisplay(25.4, 'inches')).toBeCloseTo(1);
    expect(displayToMm(2, 'inches')).toBeCloseTo(50.8);
    expect(mmToDisplay(7, 'mm')).toBe(7);
  });
});

describe('snapping', () => {
  it('snaps to grid', () => {
    expect(snapToGrid(1.26, 0.5)).toBeCloseTo(1.5);
    expect(snapToGrid(1.24, 0.5)).toBeCloseTo(1);
  });

  it('aligns to a nearby edge and reports a guide', () => {
    const dragged = { x: 9.8, y: 0, width: 5, height: 5 };
    const result = computeAlignmentSnap(dragged, [{ x: 10, y: 20, width: 5, height: 5 }], 0.5);
    expect(result.dx).toBeCloseTo(0.2);
    expect(result.guides.some((g) => g.axis === 'x' && g.position === 10)).toBe(true);
  });

  it('ignores edges beyond the threshold', () => {
    const result = computeAlignmentSnap(
      { x: 0, y: 0, width: 5, height: 5 },
      [{ x: 50, y: 50, width: 5, height: 5 }],
      0.5,
    );
    expect(result.guides).toHaveLength(0);
  });
});

describe('resizeBBox', () => {
  const start = { x: 10, y: 10, width: 20, height: 10 };

  it('drags the se corner', () => {
    const b = resizeBBox({ start, handle: 'se', dx: 5, dy: 3, proportional: false, minSize: 1 });
    expect(b).toEqual({ x: 10, y: 10, width: 25, height: 13 });
  });

  it('drags the nw corner, moving the origin', () => {
    const b = resizeBBox({ start, handle: 'nw', dx: 2, dy: 2, proportional: false, minSize: 1 });
    expect(b).toEqual({ x: 12, y: 12, width: 18, height: 8 });
  });

  it('keeps aspect ratio when proportional', () => {
    const b = resizeBBox({ start, handle: 'se', dx: 10, dy: 0, proportional: true, minSize: 1 });
    expect(b.width / b.height).toBeCloseTo(2);
  });

  it('enforces minimum size', () => {
    const b = resizeBBox({ start, handle: 'se', dx: -50, dy: -50, proportional: false, minSize: 1 });
    expect(b.width).toBe(1);
    expect(b.height).toBe(1);
  });
});
