import { describe, it, expect } from 'vitest';
import { offsetPolyline, fillStroke, boldStrokeWidth } from '../../src/gcode/fill';
import { buildToolpath } from '../../src/gcode/toolpath';
import { distanceToSegment, type Vec2 } from '../../src/utils/geometry';
import type { Label, TextElement } from '../../src/elements/types';
import type { MachineProfile } from '../../src/machineProfiles/types';
import proverxl from '../../src/machineProfiles/builtin/proverxl4030v2.json';

const profile = proverxl as MachineProfile;

describe('offsetPolyline', () => {
  it('moves a straight segment perpendicular by the offset distance', () => {
    const line: Vec2[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const up = offsetPolyline(line, 0.3);
    expect(up[0].y).toBeCloseTo(0.3);
    expect(up[1].y).toBeCloseTo(0.3);
    const down = offsetPolyline(line, -0.3);
    expect(down[0].y).toBeCloseTo(-0.3);
  });

  it('preserves vertex count and keeps closed loops closed', () => {
    const square: Vec2[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ];
    const out = offsetPolyline(square, 0.5);
    expect(out).toHaveLength(square.length);
    expect(out[0]).toEqual(out[out.length - 1]);
  });

  it('returns a copy unchanged for a zero offset', () => {
    const line: Vec2[] = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    expect(offsetPolyline(line, 0)).toEqual(line);
  });
});

describe('fillStroke', () => {
  const line: Vec2[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ];

  it('returns only the centreline when the bit already covers the width', () => {
    expect(fillStroke(line, 0.2, 0.3)).toEqual([line]);
  });

  it('adds symmetric fill passes for a wider bold stroke', () => {
    const passes = fillStroke(line, 1.0, 0.3);
    expect(passes.length).toBeGreaterThan(1);
    // Centreline plus an equal number of passes either side.
    expect((passes.length - 1) % 2).toBe(0);
  });

  it('covers the full bold width — outer passes reach within strokeWidth/2', () => {
    const width = 1.2;
    const bit = 0.3;
    const passes = fillStroke(line, width, bit);
    let maxOffset = 0;
    for (const pass of passes) {
      for (const p of pass) maxOffset = Math.max(maxOffset, Math.abs(p.y));
    }
    // Outermost pass centre + bit radius should reach the stroke edge.
    expect(maxOffset + bit / 2).toBeCloseTo(width / 2, 5);
  });

  it('spaces passes no wider than the bit so there are no unfilled gaps', () => {
    const passes = fillStroke(line, 2.0, 0.3);
    const offsets = passes.map((p) => p[0].y).sort((a, b) => a - b);
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i] - offsets[i - 1]).toBeLessThanOrEqual(0.3 + 1e-9);
    }
  });
});

function textEl(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 't1',
    type: 'text',
    text: 'WARNING',
    fontName: 'hershey_simplex',
    fontSize: 6,
    lineSpacing: 2,
    align: 'left',
    engraveDepth: null,
    bold: false,
    x: 10,
    y: 10,
    width: 40,
    height: 6,
    rotation: 0,
    locked: false,
    ...overrides,
  };
}

function makeLabel(elements: Label['elements']): Label {
  return { id: 'l1', name: 'Test', width: 100, height: 50, elements, backgroundColor: '#fff' };
}

describe('bold text in buildToolpath', () => {
  it('emits more passes when bold, at the same depth, without changing normal text', () => {
    const normal = buildToolpath({ label: makeLabel([textEl()]), profile, originX: 0, originY: 0 });
    const bold = buildToolpath({ label: makeLabel([textEl({ bold: true })]), profile, originX: 0, originY: 0 });
    expect(bold.length).toBeGreaterThan(normal.length);
    // Bold only adds fill passes — the engrave depth is unchanged.
    for (const op of bold) expect(op.depth).toBe(normal[0].depth);
  });

  it('keeps the fill passes within the bold stroke band around the centrelines', () => {
    const bold = buildToolpath({
      label: makeLabel([textEl({ bold: true })]),
      profile,
      originX: 0,
      originY: 0,
    });
    const normal = buildToolpath({ label: makeLabel([textEl()]), profile, originX: 0, originY: 0 });
    const half = boldStrokeWidth(6) / 2;
    // Every bold point lies within half the bold width of some centreline segment.
    for (const op of bold) {
      for (const p of op.points) {
        let nearest = Infinity;
        for (const c of normal) {
          for (let i = 1; i < c.points.length; i++) {
            nearest = Math.min(nearest, distanceToSegment(p, c.points[i - 1], c.points[i]));
          }
        }
        expect(nearest).toBeLessThanOrEqual(half + 1e-6);
      }
    }
  });

  it('leaves bold off by default', () => {
    const el = textEl();
    expect(el.bold).toBe(false);
    const ops = buildToolpath({ label: makeLabel([textEl({ bold: undefined })]), profile, originX: 0, originY: 0 });
    const normal = buildToolpath({ label: makeLabel([textEl()]), profile, originX: 0, originY: 0 });
    expect(ops.length).toBe(normal.length);
  });
});
