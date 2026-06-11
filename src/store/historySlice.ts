import type { StateCreator } from 'zustand';
import type { AppState, HistorySlice } from './types';

const MAX_HISTORY = 100;

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = (set, get) => ({
  past: [],
  future: [],

  pushHistory: () => {
    const { past, project } = get();
    set({ past: [...past.slice(-MAX_HISTORY + 1), project.label], future: [] });
  },

  undo: () => {
    const { past, future, project } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [project.label, ...future],
      project: { ...project, label: previous },
      selectedIds: [],
      editingTextId: null,
    });
  },

  redo: () => {
    const { past, future, project } = get();
    if (future.length === 0) return;
    const [next, ...rest] = future;
    set({
      past: [...past, project.label],
      future: rest,
      project: { ...project, label: next },
      selectedIds: [],
      editingTextId: null,
    });
  },
});
