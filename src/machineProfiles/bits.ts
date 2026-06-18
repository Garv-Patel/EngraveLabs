import type { Bit, MachineProfile } from './types';

/** Used when a profile predates the bit library (older user profiles). */
export function fallbackBit(profile?: Pick<MachineProfile, 'toolDiameter'>): Bit {
  return { id: 'default', name: 'Default tool', type: 'engrave', diameter: profile?.toolDiameter ?? 0.2 };
}

/** The bit list for a profile, always non-empty. */
export function profileBits(profile: MachineProfile): Bit[] {
  return profile.bits && profile.bits.length > 0 ? profile.bits : [fallbackBit(profile)];
}

/** Resolve an element's bit (null/unknown → the profile default → first bit). */
export function resolveBit(profile: MachineProfile, bitId: string | null | undefined): Bit {
  const bits = profileBits(profile);
  if (bitId) {
    const found = bits.find((b) => b.id === bitId);
    if (found) return found;
  }
  return bits.find((b) => b.id === profile.defaultBitId) ?? bits[0];
}

/** Engraved/cut line width in mm for canvas preview. */
export function bitWidthMm(bit: Bit): number {
  return Math.max(0.05, bit.diameter);
}

export function bitLabel(bit: Bit): string {
  if (bit.type === 'vbit' && bit.angle) return `${bit.name} (${bit.angle}° V)`;
  return `${bit.name} (${bit.diameter} mm ${bit.type})`;
}
