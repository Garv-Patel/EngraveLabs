export type GcodeDialectId = 'grbl' | 'mach3' | 'linuxcnc';

/**
 * A physical cutter. Engraved line width comes from the bit, not from faking
 * thickness with parallel passes — so the pattern matches what the machine
 * actually cuts. To make text or a shape heavier, pick a wider bit.
 */
export type BitType = 'engrave' | 'vbit' | 'flat' | 'ball';

export interface Bit {
  id: string;
  name: string;
  type: BitType;
  /** mm — marking/cutting width at the surface (tip width for V-bits). */
  diameter: number;
  /** Included angle in degrees — V-bits only. */
  angle?: number;
}

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
  /** Tool library. Elements reference a bit by id; null = defaultBitId. */
  bits?: Bit[];
  defaultBitId?: string;
}
