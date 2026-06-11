import type { Element, Label, ShapeElement } from './types';

/**
 * Convert legacy v1 'border' elements (removed in favour of cut-mode shapes)
 * into cut rectangles, and backfill fields added to ShapeElement since.
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
      passCount: 1,
      engraveDepth: (raw.engraveDepth as number | null) ?? null,
    };
    return shape;
  }
  return raw as unknown as Element;
}

export function migrateLabel(label: Label): Label {
  return {
    ...label,
    elements: label.elements.map((el) => migrateElement(el as unknown as Record<string, unknown>, label)),
  };
}
