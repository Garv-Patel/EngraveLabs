import type { MachineProfile } from './types';
import proverxl from './builtin/proverxl4030v2.json';

const STORAGE_KEY = 'engravelab.machineProfiles';

const builtinProfiles: MachineProfile[] = [proverxl as MachineProfile];

export function getBuiltinProfiles(): MachineProfile[] {
  return builtinProfiles;
}

export function isBuiltinProfile(id: string): boolean {
  return builtinProfiles.some((p) => p.id === id);
}

export function loadUserProfiles(): MachineProfile[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MachineProfile[]) : [];
  } catch {
    return [];
  }
}

export function saveUserProfiles(profiles: MachineProfile[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function getAllProfiles(): MachineProfile[] {
  return [...builtinProfiles, ...loadUserProfiles()];
}

export function getProfile(id: string): MachineProfile | undefined {
  return getAllProfiles().find((p) => p.id === id);
}

export const DEFAULT_PROFILE_ID = builtinProfiles[0].id;
