import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState } from './types';
import { createProjectSlice } from './projectSlice';
import { createMachineSlice } from './machineSlice';
import { createUiSlice } from './uiSlice';
import { createHistorySlice } from './historySlice';
import { getProfile, getBuiltinProfiles } from '../machineProfiles/profileRegistry';
import type { MachineProfile } from '../machineProfiles/types';

export const useStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createProjectSlice(...args),
      ...createMachineSlice(...args),
      ...createUiSlice(...args),
      ...createHistorySlice(...args),
    }),
    {
      name: 'engravelab.project',
      partialize: (s) => ({
        project: s.project,
        gridEnabled: s.gridEnabled,
        gridSpacing: s.gridSpacing,
        theme: s.theme,
      }),
    },
  ),
);

/** Resolve the active machine profile (built-in, user, or fallback). */
export function selectActiveProfile(s: AppState): MachineProfile {
  return (
    s.userProfiles.find((p) => p.id === s.project.machineProfileId) ??
    getProfile(s.project.machineProfileId) ??
    getBuiltinProfiles()[0]
  );
}

export * from './types';
