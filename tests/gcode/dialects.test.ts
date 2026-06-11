import { describe, it, expect } from 'vitest';
import { grbl } from '../../src/gcode/dialects/grbl';
import { mach3 } from '../../src/gcode/dialects/mach3';
import { linuxcnc } from '../../src/gcode/dialects/linuxcnc';
import type { MachineProfile } from '../../src/machineProfiles/types';
import proverxl from '../../src/machineProfiles/builtin/proverxl4030v2.json';

const profile = proverxl as MachineProfile;
const ctx = { profile, projectName: 'test' };

describe('dialects', () => {
  it.each([grbl, mach3, linuxcnc])('$id header starts with G21 and includes G90', (d) => {
    const header = d.header(ctx);
    expect(header[0]).toBe('G21');
    expect(header).toContain('G90');
  });

  it('emits G91 in incremental mode', () => {
    const inc = { ...profile, coordMode: 'incremental' as const };
    expect(grbl.header({ profile: inc, projectName: 't' })).toContain('G91');
  });

  it('grbl/mach3 use parenthesis comments, linuxcnc uses semicolons', () => {
    expect(grbl.comment('hello')).toBe('(hello)');
    expect(mach3.comment('hello')).toBe('(hello)');
    expect(linuxcnc.comment('hello')).toBe('; hello');
  });

  it('strips nested parentheses from comments', () => {
    expect(grbl.comment('a (b) c')).toBe('(a b c)');
  });

  it('footer ends with the profile program end command', () => {
    for (const d of [grbl, mach3, linuxcnc]) {
      expect(d.footer(ctx)).toContain('M30');
    }
  });
});
