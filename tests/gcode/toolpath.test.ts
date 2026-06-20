import { describe, it, expect } from 'vitest';
import {
  buildToolpath,
  optimizeTravel,
  orderElements,
  elementStrokes,
  elementDepth,
  partBBox,
  partToMachine,
  type PathOp,
} from '../../src/gcode/toolpath';
import { distance, type Vec2 } from '../../src/utils/geometry';
import type { Label, TextElement, ShapeElement } from '../../src/elements/types';
import type { MachineProfile } from '../../src/machineProfiles/types';
import proverxl from '../../src/machineProfiles/builtin/proverxl4030v2.json';

const profile = proverxl as MachineProfile;

/** Total rapid travel between consecutive ops, the cost the optimiser targets. */
function rapidTravel(ops: PathOp[], start: Vec2): number {
  let cur = start;
  let total = 0;
  for (const op of ops) {
    total += distance(cur, op.points[0]);
    cur = op.points[op.points.length - 1];
  }
  return total;
}

function seg(ax: number, ay: number, bx: number, by: number): PathOp {
  return { points: [{ x: ax, y: ay }, { x: bx, y: by }], depth: 0.3 };
}

function textEl(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 't1',
    type: 'text',
    text: 'AB',
    fontName: 'hershey_simplex',
    fontSize: 6,
    lineSpacing: 2,
    align: 'left',
    engraveDepth: null,
    x: 10,
    y: 10,
    width: 12,
    height: 6,
    rotation: 0,
    locked: false,
    ...overrides,
  };
}

function cutRectEl(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: 'b1',
    type: 'shape',
    shapeKind: 'rectangle',
    mode: 'cut',
    cornerRadius: 0,
    engraveDepth: null,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    locked: false,
    ...overrides,
  };
}

function makeLabel(elements: Label['elements']): Label {
  return { id: 'l1', name: 'Test', width: 100, height: 50, elements, backgroundColor: '#fff' };
}

describe('optimizeTravel', () => {
  const start = { x: 0, y: 0 };

  it('reorders scattered paths into a near-nearest-neighbour chain', () => {
    // Three segments placed so renderer order zig-zags the long way.
    const ops = [seg(100, 0, 110, 0), seg(0, 0, 10, 0), seg(50, 0, 60, 0)];
    const before = rapidTravel(ops, start);
    const { ops: after } = optimizeTravel(ops, start);
    expect(rapidTravel(after, start)).toBeLessThan(before);
    // Nearest path first.
    expect(after[0].points[0]).toEqual({ x: 0, y: 0 });
  });

  it('reverses an open path to enter from the closer end', () => {
    // The tool sits at x=0; this path is far cheaper entered from its (10,0) end.
    const { ops } = optimizeTravel([seg(100, 0, 10, 0)], start);
    expect(ops[0].points[0]).toEqual({ x: 10, y: 0 });
    expect(ops[0].points[ops[0].points.length - 1]).toEqual({ x: 100, y: 0 });
  });

  it('rotates a closed loop to begin at the vertex nearest the tool', () => {
    const square: PathOp = {
      points: [
        { x: 50, y: 50 },
        { x: 60, y: 50 },
        { x: 60, y: 60 },
        { x: 50, y: 60 },
        { x: 50, y: 50 },
      ],
      depth: 0.3,
    };
    const { ops } = optimizeTravel([square], start);
    const pts = ops[0].points;
    // Closest vertex to the origin is (50,50); the loop should start and end there.
    expect(pts[0]).toEqual({ x: 50, y: 50 });
    expect(pts[pts.length - 1]).toEqual({ x: 50, y: 50 });
    // Still a closed loop of the same vertices.
    expect(pts).toHaveLength(square.points.length);
  });

  it('never drops or duplicates a path', () => {
    const ops = [seg(0, 0, 1, 0), seg(20, 20, 21, 20), seg(5, 9, 6, 9)];
    const { ops: after } = optimizeTravel(ops, start);
    expect(after).toHaveLength(ops.length);
  });
});

describe('buildToolpath travel', () => {
  it('cuts rapid travel versus naive renderer order for real text', () => {
    // Two text blocks far apart plus an outline: plenty of travel to shave.
    const label = makeLabel([
      cutRectEl(),
      textEl({ id: 'l', text: 'HELLO', x: 5, y: 5 }),
      textEl({ id: 'r', text: 'WORLD', x: 60, y: 35 }),
    ]);
    const part = partBBox(label);

    // Naive toolpath: every stroke in plain element/renderer order, the way the
    // generator used to emit them, with no reordering or path reversal.
    const naiveOps: PathOp[] = [];
    for (const el of orderElements(label.elements)) {
      const depth = elementDepth(el, profile);
      for (const stroke of elementStrokes(el)) {
        if (stroke.length < 2) continue;
        naiveOps.push({ points: stroke.map((p) => partToMachine(p, part, 0, 0)), depth });
      }
    }

    const optimized = buildToolpath({ label, profile, originX: 0, originY: 0 });
    const start = { x: 0, y: 0 };
    expect(rapidTravel(optimized, start)).toBeLessThan(rapidTravel(naiveOps, start));
    // Same amount of engraving — only the travel between strokes changed.
    expect(optimized).toHaveLength(naiveOps.length);
  });

  it('keeps the cut outline last and area-ordered after optimisation', () => {
    const inner = cutRectEl({ id: 'inner', x: 40, y: 20, width: 10, height: 10 });
    const label = makeLabel([cutRectEl(), inner, textEl()]);
    const ops = buildToolpath({ label, profile, originX: 0, originY: 0 });
    const cutOps = ops.filter((o) => o.depth === profile.materialThickness);
    const span = (o: PathOp) =>
      Math.max(...o.points.map((p) => p.x)) - Math.min(...o.points.map((p) => p.x));
    expect(span(cutOps[0])).toBeCloseTo(10);
    expect(span(cutOps[cutOps.length - 1])).toBeCloseTo(100);
  });
});
