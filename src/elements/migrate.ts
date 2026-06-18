import type { Element, Label, ShapeElement } from './types';

/**
 * Convert legacy v1 'border' elements (removed in favour of cut-mode shapes)
 * into cut rectangles, drop the old multi-pass thickness fields (replaced by
 * per-element bit selection), and backfill fields added since.
 */
export function migrateElement(raw: Record<string, unknown>, label: { width: number; height: number }): Element {
  if (raw.type === 'border') {
    const shape: ShapeElement = {
      id: (raw.id as string) ?? crypto.randomUUID(),
      type: 'shape',
      shapeKind: 'rectangle',
      mode: 'cut',
      x: 0,
      y: 0,
      width: label.width,
      height: label.height,
      rotation: 0,
      locked: false,
      cornerRadius: (raw.cornerRadius as number) ?? 0,
      engraveDepth: (raw.engraveDepth as number | null) ?? null,
      bitId: null,
    };
    return shape;
  }
  // Strip removed fields; default the bit to the profile default (null).
  const { passCount: _passCount, passSpacing: _passSpacing, ...rest } = raw as Record<string, unknown>;
  void _passCount;
  void _passSpacing;
  if (!('bitId' in rest)) rest.bitId = null;
  return rest as unknown as Element;
}

export function migrateLabel(label: Label): Label {
  return {
    ...label,
    elements: label.elements.map((el) => migrateElement(el as unknown as Record<string, unknown>, label)),
  };
}
