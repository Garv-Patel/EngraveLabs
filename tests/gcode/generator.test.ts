import { describe, it, expect } from 'vitest';
import { generateGcode, validateJob } from '../../src/gcode/generator';
import type { Label, TextElement, SymbolElement, BorderElement } from '../../src/elements/types';
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
    passCount: 1,
    passSpacing: 0.2,
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
    passCount: 1,
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

function borderEl(overrides: Partial<BorderElement> = {}): BorderElement {
  return {
    id: 'b1',
    type: 'border',
    lineThickness: 0.2,
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
  it('always cuts the border last, even when it is listed first', () => {
    const label = makeLabel([borderEl(), textEl(), symbolEl()]);
    const { ops } = generateGcode({ label, profile, originX: 0, originY: 0 });
    const comments = ops.filter((o) => o.comment).map((o) => o.comment!);
    expect(comments[comments.length - 1]).toContain('border');
    expect(comments[0]).toContain('text');
    // No border ops before the last text/symbol op
    const firstBorderIdx = ops.findIndex((o) => o.comment?.includes('border'));
    const borderDepth = profile.materialThickness;
    for (let i = 0; i < firstBorderIdx; i++) {
      expect(ops[i].depth).not.toBe(borderDepth);
    }
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

  it('multi-pass produces more ops than single pass', () => {
    const single = generateGcode({ label: makeLabel([textEl()]), profile, originX: 0, originY: 0 });
    const multi = generateGcode({
      label: makeLabel([textEl({ passCount: 3 })]),
      profile,
      originX: 0,
      originY: 0,
    });
    expect(multi.ops.length).toBe(single.ops.length * 3);
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
