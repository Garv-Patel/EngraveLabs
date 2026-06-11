import type { StateCreator } from 'zustand';
import type { AppState, Project, ProjectSlice } from './types';
import type { Element, TextElement } from '../elements/types';
import { measureTextElement } from '../elements/TextElement';
import { DEFAULT_PROFILE_ID, getProfile } from '../machineProfiles/profileRegistry';

export const PROJECT_SCHEMA_VERSION = '1';

export function createDefaultProject(): Project {
  const profile = getProfile(DEFAULT_PROFILE_ID);
  return {
    version: PROJECT_SCHEMA_VERSION,
    units: 'mm',
    machineProfileId: DEFAULT_PROFILE_ID,
    label: {
      id: crypto.randomUUID(),
      name: 'Untitled label',
      width: 100,
      height: 50,
      elements: [],
      backgroundColor: '#f5e9c8',
    },
    canvasOriginX: profile ? Math.max(0, (profile.workAreaX - 100) / 2) : 0,
    canvasOriginY: profile ? Math.max(0, (profile.workAreaY - 50) / 2) : 0,
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
    set({ project, selectedIds: [], past: [], future: [], editingTextId: null });
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
        label: { ...s.project.label, elements: [...s.project.label.elements, withMeasuredSize(el)] },
      },
    }));
  },

  updateElement: (id, patch) => {
    set((s) => ({
      project: {
        ...s.project,
        label: {
          ...s.project.label,
          elements: s.project.label.elements.map((el) => {
            if (el.id !== id) return el;
            const next = { ...el, ...patch } as Element;
            const layoutChanged =
              next.type === 'text' && TEXT_LAYOUT_KEYS.some((k) => k in patch);
            return layoutChanged ? withMeasuredSize(next) : next;
          }),
        },
      },
    }));
  },

  deleteElements: (ids) => {
    if (ids.length === 0) return;
    get().pushHistory();
    set((s) => ({
      project: {
        ...s.project,
        label: {
          ...s.project.label,
          elements: s.project.label.elements.filter((el) => !ids.includes(el.id)),
        },
      },
      selectedIds: s.selectedIds.filter((sid) => !ids.includes(sid)),
    }));
  },

  duplicateElements: (ids) => {
    const els = get().project.label.elements.filter((el) => ids.includes(el.id) && el.type !== 'border');
    if (els.length === 0) return [];
    get().pushHistory();
    const copies = els.map((el) => ({ ...el, id: crypto.randomUUID(), x: el.x + 2, y: el.y + 2 }));
    set((s) => ({
      project: {
        ...s.project,
        label: { ...s.project.label, elements: [...s.project.label.elements, ...copies] },
      },
      selectedIds: copies.map((c) => c.id),
    }));
    return copies.map((c) => c.id);
  },
});
