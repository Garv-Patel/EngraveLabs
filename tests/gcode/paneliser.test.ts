import { describe, it, expect } from 'vitest';
import { planPanel, generatePanelGcode, findOuterCutShape } from '../../src/gcode/paneliser';
import { migrateLabel } from '../../src/elements/migrate';
import type { Label, ShapeElement, TextElement } from '../../src/elements/types';
import type { MachineProfile } from '../../src/machineProfiles/types';
import proverxl from '../../src/machineProfiles/builtin/proverxl4030v2.json';

const profile = proverxl as MachineProfile;

function shape(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    shapeKind: 'rectangle',
    mode: 'cut',
    cornerRadius: 0,
    passCount: 1,
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

function textEl(): TextElement {
  return {
    id: 't1',
    type: 'text',
    text: 'A',
    fontName: 'hershey_simplex',
    fontSize: 6,
    passCount: 1,
    passSpacing: 0.2,
    lineSpacing: 2,
    align: 'left',
    engraveDepth: null,
    x: 10,
    y: 10,
    width: 6,
    height: 6,
    rotation: 0,
    locked: false,
  };
}

function makeLabel(elements: Label['elements']): Label {
  return { id: 'l1', name: 'Test', width: 100, height: 50, elements, backgroundColor: '#fff' };
}

describe('planPanel', () => {
  it('uses the shared grid for square-corner rectangles and fills the sheet', () => {
    const plan = planPanel(makeLabel([shape(), textEl()]), 400, 300)!;
    expect(plan.strategy).toBe('grid-shared');
    expect(plan.cols).toBe(4);
    expect(plan.rows).toBe(6);
    expect(plan.count).toBe(24);
  });

  it('packs from the origin corner so leftover stock is on the far sides', () => {
    const plan = planPanel(makeLabel([shape()]), 250, 120)!;
    // 2 cols × 2 rows fit; all cells in the low corner
    expect(plan.count).toBe(4);
    expect(plan.cells).toContainEqual({ x: 0, y: 0 });
    expect(Math.max(...plan.cells.map((c) => c.x + plan.tileW))).toBeLessThanOrEqual(250);
  });

  it('uses plain grid for rounded rectangles', () => {
    const plan = planPanel(makeLabel([shape({ cornerRadius: 3 })]), 400, 300)!;
    expect(plan.strategy).toBe('grid');
    expect(plan.count).toBe(24);
  });

  it('hex-packs circles when offset rows fit more parts than a grid', () => {
    // 40 mm circles, 220 × 290 sheet: grid = 5 × 7 = 35; hex = 8 rows × 5 = 40
    const circle = shape({ shapeKind: 'circle', width: 40, height: 40 });
    const plan = planPanel(makeLabel([circle]), 220, 290)!;
    expect(plan.strategy).toBe('hex');
    expect(plan.rows).toBe(8);
    expect(plan.count).toBe(40);
    // Odd rows offset by half a tile width
    const row1 = plan.cells.filter((c) => Math.abs(c.y - (40 * Math.sqrt(3)) / 2) < 0.01);
    expect(row1[0].x).toBeCloseTo(20);
  });

  it('falls back to a plain grid for circles when hex would fit fewer', () => {
    // 40 mm circles, 200 × 200 sheet: grid = 25, hex = 23
    const circle = shape({ shapeKind: 'circle', width: 40, height: 40 });
    const plan = planPanel(makeLabel([circle]), 200, 200)!;
    expect(plan.strategy).toBe('grid');
    expect(plan.count).toBe(25);
  });

  it('tiles by the outermost cut shape, not the label size', () => {
    const small = shape({ width: 30, height: 30, x: 10, y: 10 });
    const plan = planPanel(makeLabel([small, textEl()]), 100, 100)!;
    expect(plan.tileW).toBe(30);
    expect(plan.count).toBe(9);
  });

  it('returns null when there is no cut shape or nothing fits', () => {
    expect(planPanel(makeLabel([textEl()]), 400, 300)).toBeNull();
    expect(planPanel(makeLabel([shape()]), 90, 40)).toBeNull();
  });
});

describe('generatePanelGcode', () => {
  it('engraves every cell before any cut', () => {
    const result = generatePanelGcode({
      label: makeLabel([shape(), textEl()]),
      profile,
      sheetW: 200,
      sheetH: 100,
      originX: 0,
      originY: 0,
    })!;
    const firstCut = result.ops.findIndex((o) => o.depth === profile.materialThickness);
    const lastEngrave = result.ops.map((o) => o.depth).lastIndexOf(profile.engraveDepth);
    expect(firstCut).toBeGreaterThan(lastEngrave);
  });

  it('shared grid emits (cols+1) + (rows+1) straight cut lines', () => {
    const result = generatePanelGcode({
      label: makeLabel([shape(), textEl()]),
      profile,
      sheetW: 200,
      sheetH: 100,
      originX: 0,
      originY: 0,
    })!;
    expect(result.plan.count).toBe(4); // 2 × 2
    const cutOps = result.ops.filter((o) => o.depth === profile.materialThickness);
    expect(cutOps).toHaveLength(3 + 3); // 3 vertical + 3 horizontal lines
    for (const op of cutOps) expect(op.points).toHaveLength(2);
  });

  it('non-shared strategies cut each cell individually', () => {
    const result = generatePanelGcode({
      label: makeLabel([shape({ cornerRadius: 5 }), textEl()]),
      profile,
      sheetW: 200,
      sheetH: 100,
      originX: 0,
      originY: 0,
    })!;
    const cutOps = result.ops.filter((o) => o.depth === profile.materialThickness);
    expect(cutOps).toHaveLength(4); // one rounded outline per cell
  });

  it('offsets engraving relative to the outer shape and sheet origin', () => {
    const result = generatePanelGcode({
      label: makeLabel([shape(), textEl()]),
      profile,
      sheetW: 100,
      sheetH: 50,
      originX: 10,
      originY: 20,
    })!;
    for (const op of result.ops) {
      for (const p of op.points) {
        expect(p.x).toBeGreaterThanOrEqual(10 - 1e-9);
        expect(p.x).toBeLessThanOrEqual(10 + 100 + 1e-9);
        expect(p.y).toBeGreaterThanOrEqual(20 - 1e-9);
        expect(p.y).toBeLessThanOrEqual(20 + 50 + 1e-9);
      }
    }
  });
});

describe('migrateLabel', () => {
  it('converts legacy border elements into cut rectangles', () => {
    const legacy = {
      id: 'l1',
      name: 'Old',
      width: 80,
      height: 40,
      backgroundColor: '#fff',
      elements: [
        {
          id: 'b1',
          type: 'border',
          lineThickness: 0.2,
          cornerRadius: 2,
          engraveDepth: null,
          x: 0,
          y: 0,
          width: 80,
          height: 40,
          rotation: 0,
          locked: false,
        },
      ],
    } as unknown as Label;
    const migrated = migrateLabel(legacy);
    const el = migrated.elements[0];
    expect(el.type).toBe('shape');
    if (el.type === 'shape') {
      expect(el.mode).toBe('cut');
      expect(el.cornerRadius).toBe(2);
      expect(el.width).toBe(80);
    }
    expect(findOuterCutShape(migrated)?.id).toBe('b1');
  });
});
