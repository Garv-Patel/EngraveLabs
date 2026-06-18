import { useStore } from '../../store';
import { partBBox } from '../../gcode/toolpath';

export type AlignAction = 'left' | 'centreH' | 'right' | 'top' | 'centreV' | 'bottom';

/** Align the current selection. With one element selected, aligns to the part outline. */
export function alignSelection(action: AlignAction): void {
  const s = useStore.getState();
  const els = s.project.label.elements.filter((el) => s.selectedIds.includes(el.id) && !el.locked);
  if (els.length === 0) return;
  s.pushHistory();

  const part = partBBox(s.project.label);
  const bounds =
    els.length === 1
      ? { x: part.x, y: part.y, right: part.x + part.width, bottom: part.y + part.height }
      : {
          x: Math.min(...els.map((e) => e.x)),
          y: Math.min(...els.map((e) => e.y)),
          right: Math.max(...els.map((e) => e.x + e.width)),
          bottom: Math.max(...els.map((e) => e.y + e.height)),
        };

  for (const el of els) {
    switch (action) {
      case 'left':
        s.updateElement(el.id, { x: bounds.x });
        break;
      case 'centreH':
        s.updateElement(el.id, { x: (bounds.x + bounds.right) / 2 - el.width / 2 });
        break;
      case 'right':
        s.updateElement(el.id, { x: bounds.right - el.width });
        break;
      case 'top':
        s.updateElement(el.id, { y: bounds.y });
        break;
      case 'centreV':
        s.updateElement(el.id, { y: (bounds.y + bounds.bottom) / 2 - el.height / 2 });
        break;
      case 'bottom':
        s.updateElement(el.id, { y: bounds.bottom - el.height });
        break;
    }
  }
}

/** Evenly distribute three or more selected elements along an axis. */
export function distributeSelection(axis: 'h' | 'v'): void {
  const s = useStore.getState();
  const els = s.project.label.elements.filter((el) => s.selectedIds.includes(el.id) && !el.locked);
  if (els.length < 3) return;
  s.pushHistory();

  const sorted = [...els].sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSize = sorted.reduce((sum, e) => sum + (axis === 'h' ? e.width : e.height), 0);
  const span =
    axis === 'h' ? last.x + last.width - first.x : last.y + last.height - first.y;
  const gap = (span - totalSize) / (sorted.length - 1);

  let cursor = axis === 'h' ? first.x : first.y;
  for (const el of sorted) {
    if (axis === 'h') {
      s.updateElement(el.id, { x: cursor });
      cursor += el.width + gap;
    } else {
      s.updateElement(el.id, { y: cursor });
      cursor += el.height + gap;
    }
  }
}
