import type { StateCreator } from 'zustand';
import type { AppState, MachineSlice } from './types';
import { loadUserProfiles, saveUserProfiles, isBuiltinProfile } from '../machineProfiles/profileRegistry';

export const createMachineSlice: StateCreator<AppState, [], [], MachineSlice> = (set, get) => ({
  userProfiles: loadUserProfiles(),

  saveUserProfile: (profile) => {
    if (isBuiltinProfile(profile.id)) return;
    const next = [...get().userProfiles.filter((p) => p.id !== profile.id), profile];
    saveUserProfiles(next);
    set({ userProfiles: next });
  },

  deleteUserProfile: (id) => {
    if (isBuiltinProfile(id)) return;
    const next = get().userProfiles.filter((p) => p.id !== id);
    saveUserProfiles(next);
    set({ userProfiles: next });
  },
});
