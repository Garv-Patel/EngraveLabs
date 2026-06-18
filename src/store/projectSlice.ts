import type { StateCreator } from 'zustand';
import type { AppState, Project, ProjectSlice } from './types';
import type { Element, Label, ShapeElement, TextElement } from '../elements/types';
import { measureTextElement } from '../elements/TextElement';
import { migrateLabel } from '../elements/migrate';
import { DEFAULT_PROFILE_ID } from '../machineProfiles/profileRegistry';

export const PROJECT_SCHEMA_VERSION = '1';

/** The default outline: a cut rectangle matching the label, resizable like any shape. */
export function defaultOutlineShape(width: number, height: number): ShapeElement {
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    shapeKind: 'rectangle',
    mode: 'cut',
    x: 0,
    y: 0,
    width,
    height,
    rotation: 0,
    locked: false,
    cornerRadius: 0,
    engraveDepth: null,
    bitId: null,
  };
}

/**
 * The part outline is defined by the outermost cut shape — the label rectangle
 * is no longer set by hand, it just tracks the content. Returns the extent
 * (from origin) of the outermost cut shape, or of all content if there is no
 * cut shape, or null to keep the current size when the label is empty.
 */
function labelExtent(elements: Element[]): { width: number; height: number } | null {
  const cuts = elements.filter((e) => e.type === 'shape' && e.mode === 'cut');
  const source = cuts.length > 0 ? [cuts.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a))] : elements;
  if (source.length === 0) return null;
  let maxX = 0;
  let maxY = 0;
  for (const e of source) {
    maxX = Math.max(maxX, e.x + e.width);
    maxY = Math.max(maxY, e.y + e.height);
  }
  return { width: Math.max(maxX, 1), height: Math.max(maxY, 1) };
}

/** Apply a new element list and resize the label to follow the outline. */
function sizedLabel(label: Label, elements: Element[]): Label {
  const ext = labelExtent(elements);
  return ext ? { ...label, elements, width: ext.width, height: ext.height } : { ...label, elements };
}

export function createDefaultProject(): Project {
  return {
    version: PROJECT_SCHEMA_VERSION,
    units: 'mm',
    machineProfileId: DEFAULT_PROFILE_ID,
    label: {
      id: crypto.randomUUID(),
      name: 'Untitled label',
      width: 100,
      height: 50,
      elements: [defaultOutlineShape(100, 50)],
      backgroundColor: '#f5e9c8',
    },
    // Label sits at the machine origin so G-code coordinates start near zero.
    canvasOriginX: 0,
    canvasOriginY: 0,
  };
}

/** Re-measure a text element's bounding box after content/font changes. */
function withMeasuredSize(el: Element): Element {
  if (el.type !== 'text') return el;
  const { width, height } = measureTextElement(el);
  return { ...el, width: Math.max(width, 1), height: Math.max(height, 1) };
}

const TEXT_LAYOUT_KEYS: (keyof TextElement)[] = ['text', 'fontName', 'fontSize', 'lineSpacing', 'align'];

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set, get) => ({
  project: createDefaultProject(),

  newProject: () => {
    get().pushHistory();
    set({ project: createDefaultProject(), selectedIds: [], past: [], future: [] });
  },

  loadProject: (project) => {
    const migrated = { ...project, label: migrateLabel(project.label) };
    set({ project: migrated, selectedIds: [], past: [], future: [], editingTextId: null });
  },

  setUnits: (units) => set((s) => ({ project: { ...s.project, units } })),

  setMachineProfileId: (id) => set((s) => ({ project: { ...s.project, machineProfileId: id } })),

  setCanvasOrigin: (x, y) => set((s) => ({ project: { ...s.project, canvasOriginX: x, canvasOriginY: y } })),

  setLabelName: (name) => set((s) => ({ project: { ...s.project, label: { ...s.project.label, name } } })),

  setLabelSize: (width, height) => {
    get().pushHistory();
    set((s) => ({ project: { ...s.project, label: { ...s.project.label, width, height } } }));
  },

  addElement: (el) => {
    get().pushHistory();
    set((s) => ({
      project: {
        ...s.project,
        label: sizedLabel(s.project.label, [...s.project.label.elements, withMeasuredSize(el)]),
      },
    }));
  },

  updateElement: (id, patch) => {
    set((s) => ({
      project: {
        ...s.project,
        label: sizedLabel(
          s.project.label,
          s.project.label.elements.map((el) => {
            if (el.id !== id) return el;
            const next = { ...el, ...patch } as Element;
            const layoutChanged =
              next.type === 'text' && TEXT_LAYOUT_KEYS.some((k) => k in patch);
            return layoutChanged ? withMeasuredSize(next) : next;
          }),
        ),
      },
    }));
  },

  deleteElements: (ids) => {
    if (ids.length === 0) return;
    get().pushHistory();
    set((s) => ({
      project: {
        ...s.project,
        label: sizedLabel(
          s.project.label,
          s.project.label.elements.filter((el) => !ids.includes(el.id)),
        ),
      },
      selectedIds: s.selectedIds.filter((sid) => !ids.includes(sid)),
    }));
  },

  duplicateElements: (ids) => {
    const els = get().project.label.elements.filter((el) => ids.includes(el.id));
    if (els.length === 0) return [];
    get().pushHistory();
    const copies = els.map((el) => ({ ...el, id: crypto.randomUUID(), x: el.x + 2, y: el.y + 2 }));
    set((s) => ({
      project: {
        ...s.project,
        label: sizedLabel(s.project.label, [...s.project.label.elements, ...copies]),
      },
      selectedIds: copies.map((c) => c.id),
    }));
    return copies.map((c) => c.id);
  },
});
