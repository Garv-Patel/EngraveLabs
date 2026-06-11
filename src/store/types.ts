import type { Element, Label } from '../elements/types';
import type { MachineProfile } from '../machineProfiles/types';
import type { DisplayUnit } from '../utils/units';

export interface Project {
  version: string; // schema version
  units: DisplayUnit; // display unit (all stored values always in mm)
  machineProfileId: string;
  label: Label; // one label per project (v1)
  canvasOriginX: number; // mm offset of label on machine bed
  canvasOriginY: number;
}

export type Tool = 'select' | 'text' | 'symbol' | 'border';

export interface ProjectSlice {
  project: Project;
  newProject: () => void;
  loadProject: (project: Project) => void;
  setUnits: (units: DisplayUnit) => void;
  setMachineProfileId: (id: string) => void;
  setCanvasOrigin: (x: number, y: number) => void;
  setLabelName: (name: string) => void;
  setLabelSize: (width: number, height: number) => void;
  addElement: (el: Element) => void;
  updateElement: (id: string, patch: Partial<Element>) => void;
  deleteElements: (ids: string[]) => void;
  duplicateElements: (ids: string[]) => string[];
}

export interface MachineSlice {
  userProfiles: MachineProfile[];
  saveUserProfile: (profile: MachineProfile) => void;
  deleteUserProfile: (id: string) => void;
}

export interface UiSlice {
  selectedIds: string[];
  activeTool: Tool;
  zoom: number;
  panX: number; // screen px
  panY: number;
  gridEnabled: boolean;
  gridSpacing: number; // mm
  editingTextId: string | null;
  theme: 'light' | 'dark';
  /** Symbol that will be placed on next canvas click with the symbol tool. */
  pendingSymbolName: string;
  setSelection: (ids: string[]) => void;
  setActiveTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setGridEnabled: (on: boolean) => void;
  setGridSpacing: (mm: number) => void;
  setEditingTextId: (id: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setPendingSymbolName: (name: string) => void;
}

export interface HistorySlice {
  past: Label[];
  future: Label[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

export type AppState = ProjectSlice & MachineSlice & UiSlice & HistorySlice;
