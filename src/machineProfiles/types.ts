export type GcodeDialectId = 'grbl' | 'mach3' | 'linuxcnc';

export interface MachineProfile {
  id: string;
  name: string;
  gcodeDialect: GcodeDialectId;
  workAreaX: number; // mm
  workAreaY: number; // mm
  defaultFeedrate: number; // mm/min
  defaultPlungeRate: number; // mm/min
  spindleSpeed: number; // RPM
  safeZ: number; // mm above material
  engraveDepth: number; // mm default cut depth
  materialThickness: number; // mm total stock thickness
  topLayerDepth: number; // mm to engraving layer (auto-fills engraveDepth on new projects)
  toolDiameter: number; // mm
  homeX: number;
  homeY: number;
  spindleOnCmd: string; // e.g. "M3"
  spindleOffCmd: string; // e.g. "M5"
  programEndCmd: string; // e.g. "M30"
  coordMode: 'absolute' | 'incremental';
  gcodeExtension: string; // e.g. "nc", "gcode", "tap"
}
