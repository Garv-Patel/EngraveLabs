import { needsRetract, type PathOp } from './toolpath';
import type { MachineProfile } from '../machineProfiles/types';
import { distance, type Vec2 } from '../utils/geometry';

const RAPID_RATE = 3000; // mm/min — conservative rapid estimate

/** Estimated job duration in seconds for a set of path operations. */
export function estimateJobSeconds(ops: PathOp[], profile: MachineProfile): number {
  let cutLength = 0;
  let rapidLength = 0;
  let plungeLength = 0;
  let prevEnd: Vec2 = { x: profile.homeX, y: profile.homeY };
  let prev: PathOp | null = null;

  for (const op of ops) {
    if (needsRetract(op, prev)) {
      if (prev) rapidLength += prev.depth + profile.safeZ; // retract from the previous stroke
      rapidLength += distance(prevEnd, op.points[0]); // rapid across at safe Z
      plungeLength += op.depth + profile.safeZ; // plunge down to depth
    } else {
      cutLength += distance(prevEnd, op.points[0]); // slide to the next stroke at depth
    }
    for (let i = 1; i < op.points.length; i++) {
      cutLength += distance(op.points[i - 1], op.points[i]);
    }
    prev = op;
    prevEnd = op.points[op.points.length - 1];
  }
  if (prev) rapidLength += prev.depth + profile.safeZ; // final retract to safe Z

  const minutes =
    cutLength / profile.defaultFeedrate + plungeLength / profile.defaultPlungeRate + rapidLength / RAPID_RATE;
  return minutes * 60;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
