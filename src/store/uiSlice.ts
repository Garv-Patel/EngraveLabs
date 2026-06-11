import type { StateCreator } from 'zustand';
import type { AppState, UiSlice } from './types';
import { clamp } from '../utils/geometry';
import { DEFAULT_SYMBOL_NAME } from '../symbols/symbolRegistry';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 20;

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set) => ({
  selectedIds: [],
  activeTool: 'select',
  zoom: 1,
  panX: 0,
  panY: 0,
  gridEnabled: true,
  gridSpacing: 0.5,
  editingTextId: null,
  theme: 'light',
  pendingSymbolName: DEFAULT_SYMBOL_NAME,

  setSelection: (ids) => set({ selectedIds: ids }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  setGridEnabled: (on) => set({ gridEnabled: on }),
  setGridSpacing: (mm) => set({ gridSpacing: Math.max(0.1, mm) }),
  setEditingTextId: (id) => set({ editingTextId: id }),
  setTheme: (theme) => set({ theme }),
  setPendingSymbolName: (name) => set({ pendingSymbolName: name }),
});
