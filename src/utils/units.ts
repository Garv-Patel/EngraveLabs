export type DisplayUnit = 'mm' | 'inches';

const MM_PER_INCH = 25.4;

/** Convert an internal mm value to the display unit. */
export function mmToDisplay(mm: number, units: DisplayUnit): number {
  return units === 'inches' ? mm / MM_PER_INCH : mm;
}

/** Convert a value entered in the display unit back to internal mm. */
export function displayToMm(val: number, units: DisplayUnit): number {
  return units === 'inches' ? val * MM_PER_INCH : val;
}

/** Format an mm value for display in the given unit. */
export function formatDisplay(mm: number, units: DisplayUnit, decimals?: number): string {
  const v = mmToDisplay(mm, units);
  const d = decimals ?? (units === 'inches' ? 3 : 2);
  return `${parseFloat(v.toFixed(d))} ${units === 'inches' ? 'in' : 'mm'}`;
}

/** Pixels per mm at zoom 1.0 (canvas world scale). */
export const BASE_PX_PER_MM = 4;

export function mmToPx(mm: number, zoom: number): number {
  return mm * BASE_PX_PER_MM * zoom;
}

export function pxToMm(px: number, zoom: number): number {
  return px / (BASE_PX_PER_MM * zoom);
}
