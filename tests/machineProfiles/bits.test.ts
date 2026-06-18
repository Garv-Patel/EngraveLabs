import { describe, it, expect } from 'vitest';
import { resolveBit, profileBits, bitWidthMm } from '../../src/machineProfiles/bits';
import type { MachineProfile } from '../../src/machineProfiles/types';
import proverxl from '../../src/machineProfiles/builtin/proverxl4030v2.json';

const profile = proverxl as MachineProfile;

describe('bits', () => {
  it('resolves a null bitId to the profile default', () => {
    expect(resolveBit(profile, null).id).toBe(profile.defaultBitId);
  });

  it('resolves a known bit by id', () => {
    expect(resolveBit(profile, 'flat-3175').type).toBe('flat');
  });

  it('falls back to the default for an unknown id', () => {
    expect(resolveBit(profile, 'does-not-exist').id).toBe(profile.defaultBitId);
  });

  it('synthesises a bit for a profile with no bit library', () => {
    const legacy = { toolDiameter: 0.3 } as MachineProfile;
    expect(profileBits(legacy)).toHaveLength(1);
    expect(resolveBit(legacy, null).diameter).toBe(0.3);
  });

  it('reports a positive preview width', () => {
    expect(bitWidthMm(resolveBit(profile, 'engrave-05'))).toBeCloseTo(0.5);
  });
});
