import type { MachineProfile } from '../../machineProfiles/types';

export interface DialectContext {
  profile: MachineProfile;
  projectName: string;
}

export interface DialectDef {
  id: string;
  name: string;
  /** Wrap a comment in dialect syntax. */
  comment(text: string): string;
  /** Preamble lines (units, coordinate mode, plane, etc.). */
  header(ctx: DialectContext): string[];
  /** Closing lines (program end). */
  footer(ctx: DialectContext): string[];
}
