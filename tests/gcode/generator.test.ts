import { describe, it, expect } from 'vitest';
import { generateGcode, validateJob } from '../../src/gcode/generator';
import { needsRetract, type PathOp } from '../../src/gcode/toolpath';
import { distance } from '../../src/utils/geometry';
import type { Label, TextElement, SymbolElement, ShapeElement } from '../../src/elements/types';
import type { MachineProfile } from '../../src/machineProfiles/types';
import proverxl from '../../src/machineProfiles/builtin/proverxl4030v2.json';

const profile = proverxl as MachineProfile;

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

function symbolEl(overrides: Partial<SymbolElement> = {}): SymbolElement {
  return {
    id: 's1',
    type: 'symbol',
    symbolName: 'warning',
    engraveDepth: null,
    x: 40,
    y: 10,
    width: 10,
    height: 10,
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

describe('generateGcode', () => {
  it('always cuts the outline last, even when it is listed first', () => {
    const label = makeLabel([cutRectEl(), textEl(), symbolEl()]);
    const { ops } = generateGcode({ label, profile, originX: 0, originY: 0 });
    const comments = ops.filter((o) => o.comment).map((o) => o.comment!);
    expect(comments[comments.length - 1]).toContain('cut');
    expect(comments[0]).toContain('text');
    // No cut ops before the last text/symbol op
    const firstCutIdx = ops.findIndex((o) => o.comment?.includes('cut'));
    const cutDepth = profile.materialThickness;
    for (let i = 0; i < firstCutIdx; i++) {
      expect(ops[i].depth).not.toBe(cutDepth);
    }
  });

  it('cuts inner shapes before the outermost outline', () => {
    const inner = cutRectEl({ id: 'inner', x: 40, y: 20, width: 10, height: 10 });
    const label = makeLabel([cutRectEl(), inner, textEl()]);
    const { ops } = generateGcode({ label, profile, originX: 0, originY: 0 });
    const cutOps = ops.filter((o) => o.depth === profile.materialThickness);
    // Inner 10×10 cut comes before the 100×50 outline
    const firstSpanX = Math.max(...cutOps[0].points.map((p) => p.x)) - Math.min(...cutOps[0].points.map((p) => p.x));
    const lastSpanX =
      Math.max(...cutOps[cutOps.length - 1].points.map((p) => p.x)) -
      Math.min(...cutOps[cutOps.length - 1].points.map((p) => p.x));
    expect(firstSpanX).toBeCloseTo(10);
    expect(lastSpanX).toBeCloseTo(100);
  });

  it('engrave-mode shapes run with engraving, before any cut', () => {
    const engraveShape = cutRectEl({ id: 'e1', mode: 'engrave', x: 10, y: 10, width: 20, height: 20 });
    const label = makeLabel([cutRectEl(), engraveShape, textEl()]);
    const { ops } = generateGcode({ label, profile, originX: 0, originY: 0 });
    const firstCutIdx = ops.findIndex((o) => o.depth === profile.materialThickness);
    const engraveShapeIdx = ops.findIndex((o) => o.comment === 'shape rectangle');
    expect(engraveShapeIdx).toBeGreaterThanOrEqual(0);
    expect(engraveShapeIdx).toBeLessThan(firstCutIdx);
  });

  it('processes text before symbols', () => {
    const label = makeLabel([symbolEl(), textEl()]);
    const { ops } = generateGcode({ label, profile, originX: 0, originY: 0 });
    const comments = ops.filter((o) => o.comment).map((o) => o.comment!);
    expect(comments[0]).toContain('text');
    expect(comments[1]).toContain('symbol');
  });

  it('uses profile engrave depth when element depth is null', () => {
    const label = makeLabel([textEl({ engraveDepth: null })]);
    const { gcode } = generateGcode({ label, profile, originX: 0, originY: 0 });
    expect(gcode).toContain(`G1 Z-${profile.engraveDepth}`);
  });

  it('respects per-element engrave depth', () => {
    const label = makeLabel([textEl({ engraveDepth: 0.55 })]);
    const { gcode } = generateGcode({ label, profile, originX: 0, originY: 0 });
    expect(gcode).toContain('G1 Z-0.55');
  });

  it('converts label space (y-down) to machine space (y-up) with origin offset', () => {
    const label = makeLabel([textEl({ x: 0, y: 0 })]);
    const { ops } = generateGcode({ label, profile, originX: 20, originY: 30 });
    // Element at label top (y=0) → machine y near originY + labelHeight
    for (const op of ops) {
      for (const p of op.points) {
        expect(p.x).toBeGreaterThanOrEqual(20);
        expect(p.y).toBeLessThanOrEqual(30 + label.height);
        expect(p.y).toBeGreaterThan(30 + label.height - 20);
      }
    }
  });

  it('emits spindle, safe Z, and program end', () => {
    const label = makeLabel([textEl()]);
    const { gcode } = generateGcode({ label, profile, originX: 0, originY: 0 });
    expect(gcode).toContain('M3 S10000');
    expect(gcode).toContain('G0 Z5');
    expect(gcode).toContain('M5');
    expect(gcode.trimEnd().endsWith('M30')).toBe(true);
    expect(gcode.indexOf('M3 ')).toBeLessThan(gcode.indexOf('G1 Z'));
  });

  it('engraves each text stroke once — line width comes from the bit, not extra passes', () => {
    const { ops } = generateGcode({ label: makeLabel([textEl({ text: 'I' })]), profile, originX: 0, originY: 0 });
    // A single capital "I" is one stroke; one op, not several offset copies.
    expect(ops).toHaveLength(1);
  });

  it('lifts to safe Z before repositioning across a gap, never dragging at depth', () => {
    // Multi-stroke text yields many same-depth engraving ops whose strokes do not
    // all join end-to-end. The generator may slide at depth only between strokes
    // that genuinely meet; every real gap must be crossed at safe Z, or the bit
    // scores straight lines through the letters.
    const { gcode, ops } = generateGcode({
      label: makeLabel([textEl({ text: 'HELLO' })]),
      profile,
      originX: 0,
      originY: 0,
    });
    expect(ops.length).toBeGreaterThan(2);

    let retracts = 0;
    for (let i = 0; i < ops.length; i++) {
      const prev = i === 0 ? null : ops[i - 1];
      if (needsRetract(ops[i], prev)) {
        retracts++;
      } else {
        // Any op that slides instead of retracting must begin exactly where the
        // previous one ended — no gap to drag across.
        const prevEnd = prev!.points[prev!.points.length - 1];
        expect(distance(prevEnd, ops[i].points[0])).toBeLessThanOrEqual(1e-3);
      }
    }
    // The disjoint letter strokes force real repositioning, so the run is many
    // plunge/retract pairs — not the single slide-through-everything pass before.
    expect(retracts).toBeGreaterThan(1);
    const plunges = gcode.split('\n').filter((l) => l.startsWith('G1 Z-')).length;
    expect(plunges).toBe(retracts);
  });

  it('only slides at depth between strokes that actually join end-to-end', () => {
    // needsRetract drives both the generator and the estimator: contiguous strokes
    // (one ending where the next begins) may slide; any gap forces a retract.
    const a: PathOp = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], depth: 0.3 };
    const joined: PathOp = { points: [{ x: 10, y: 0 }, { x: 10, y: 10 }], depth: 0.3 };
    const apart: PathOp = { points: [{ x: 50, y: 50 }, { x: 60, y: 50 }], depth: 0.3 };
    expect(needsRetract(joined, a)).toBe(false); // shares the (10,0) vertex → slide
    expect(needsRetract(apart, a)).toBe(true); // 50 mm gap → lift and reposition
  });

  it('still lifts to safe Z before a through-cut so it never drags across stock', () => {
    const inner = cutRectEl({ id: 'inner', x: 40, y: 20, width: 10, height: 10 });
    const label = makeLabel([cutRectEl(), inner, textEl()]);
    const { gcode } = generateGcode({ label, profile, originX: 0, originY: 0 });
    const lines = gcode.split('\n');
    // Each cut op (full thickness) is preceded by a retract + plunge to depth.
    const cutPlunges = lines.filter((l) => l.startsWith(`G1 Z-${profile.materialThickness} `)).length;
    const safeZMoves = lines.filter((l) => l === `G0 Z${profile.safeZ}`).length;
    expect(cutPlunges).toBe(2); // inner cutout + outline
    // At least one retract per cut entry, plus the final retract.
    expect(safeZMoves).toBeGreaterThanOrEqual(cutPlunges);
  });

  it('keys machine coordinates to the outermost cut shape, not the label rectangle', () => {
    // Outline offset inside a larger label; the part is the 30×20 cut shape.
    const outline = cutRectEl({ id: 'o', x: 10, y: 10, width: 30, height: 20 });
    const label = makeLabel([outline, textEl({ x: 15, y: 15 })]);
    const { ops } = generateGcode({ label, profile, originX: 0, originY: 0 });
    const cutOp = ops.find((o) => o.depth === profile.materialThickness)!;
    const xs = cutOp.points.map((p) => p.x);
    const ys = cutOp.points.map((p) => p.y);
    // The outline maps to the bed origin regardless of its label-space offset.
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(30);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(20);
  });
});

describe('validateJob', () => {
  it('errors on empty label', () => {
    const issues = validateJob({ label: makeLabel([]), profile, originX: 0, originY: 0 });
    expect(issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('warns when an element is outside the label', () => {
    const issues = validateJob({
      label: makeLabel([textEl({ x: 95, width: 20 })]),
      profile,
      originX: 0,
      originY: 0,
    });
    expect(issues.some((i) => i.level === 'warning' && i.message.includes('outside'))).toBe(true);
  });

  it('errors when label + origin exceeds work area', () => {
    const issues = validateJob({
      label: makeLabel([textEl()]),
      profile,
      originX: profile.workAreaX - 50,
      originY: 0,
    });
    expect(issues.some((i) => i.level === 'error' && i.message.includes('work area'))).toBe(true);
  });
});
