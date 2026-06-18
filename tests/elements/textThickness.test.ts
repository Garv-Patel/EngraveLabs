import { describe, it, expect } from 'vitest';
import { generateGcode } from '../../src/gcode/generator';
import { widenStroke } from '../../src/fonts/strokeRenderer';
import { effectiveTextThicknessMm, TEXT_THICKNESS_RATIO } from '../../src/elements/TextElement';
import type { Label, TextElement } from '../../src/elements/types';
import type { MachineProfile } from '../../src/machineProfiles/types';
import proverxl from '../../src/machineProfiles/builtin/proverxl4030v2.json';

const profile = proverxl as MachineProfile;

function textEl(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 't1',
    type: 'text',
    text: 'I',
    fontName: 'hershey_simplex',
    fontSize: 6,
    lineSpacing: 2,
    align: 'left',
    engraveDepth: null,
    bitId: null,
    x: 10,
    y: 10,
    width: 6,
    height: 6,
    rotation: 0,
    locked: false,
    ...overrides,
  };
}

const makeLabel = (el: TextElement): Label => ({
  id: 'l1',
  name: 'T',
  width: 100,
  height: 50,
  elements: [el],
  backgroundColor: '#fff',
});

describe('text thickness', () => {
  it('hairline text is a single pass', () => {
    const { ops } = generateGcode({ label: makeLabel(textEl()), profile, originX: 0, originY: 0 });
    expect(ops).toHaveLength(1);
  });

  it('a thicker-than-bit stroke is filled with extra overlapping passes', () => {
    // Default bit is 0.2 mm; ask for a 1 mm stroke.
    const { ops } = generateGcode({ label: makeLabel(textEl({ thickness: 1 })), profile, originX: 0, originY: 0 });
    expect(ops.length).toBeGreaterThan(1);
  });

  it('a thickness no wider than the bit stays a single pass', () => {
    const { ops } = generateGcode({ label: makeLabel(textEl({ thickness: 0.1 })), profile, originX: 0, originY: 0 });
    expect(ops).toHaveLength(1);
  });

  it('proportional thickness scales with font size', () => {
    expect(effectiveTextThicknessMm(textEl({ thicknessAuto: true, fontSize: 20 }), 0.2)).toBeCloseTo(
      20 * TEXT_THICKNESS_RATIO,
    );
    // Small text falls back to the bit width (never thinner than the tool).
    expect(effectiveTextThicknessMm(textEl({ thicknessAuto: true, fontSize: 1 }), 0.2)).toBe(0.2);
  });

  it('widenStroke overlaps passes to fill the band and returns the centreline alone when thin', () => {
    const stroke = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(widenStroke(stroke, 0.2, 0.2)).toEqual([stroke]);
    const passes = widenStroke(stroke, 1, 0.2);
    expect(passes.length).toBeGreaterThan(1);
    // Outermost passes reach ±(width-tool)/2 of the centreline.
    const ys = passes.flatMap((p) => p.map((q) => q.y));
    expect(Math.max(...ys)).toBeCloseTo(0.4);
    expect(Math.min(...ys)).toBeCloseTo(-0.4);
  });
});
