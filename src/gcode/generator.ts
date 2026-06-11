import type { Label } from '../elements/types';
import type { MachineProfile } from '../machineProfiles/types';
import type { DialectDef } from './dialects/types';
import { grbl } from './dialects/grbl';
import { mach3 } from './dialects/mach3';
import { linuxcnc } from './dialects/linuxcnc';
import { buildToolpath, type PathOp } from './toolpath';

export const dialects: Record<string, DialectDef> = {
  grbl,
  mach3,
  linuxcnc,
};

export function registerDialect(dialect: DialectDef): void {
  dialects[dialect.id] = dialect;
}

export interface GenerateOptions {
  label: Label;
  profile: MachineProfile;
  originX: number;
  originY: number;
  projectName?: string;
}

export interface GenerateResult {
  gcode: string;
  ops: PathOp[];
}

const fmt = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

export function generateGcode(opts: GenerateOptions): GenerateResult {
  const { label, profile, originX, originY } = opts;
  const dialect = dialects[profile.gcodeDialect] ?? grbl;
  const ctx = { profile, projectName: opts.projectName ?? label.name };
  const c = dialect.comment;
  const ops = buildToolpath({ label, profile, originX, originY });

  const lines: string[] = [];
  // 1. Program header
  lines.push(c(`EngraveLab - ${ctx.projectName}`));
  lines.push(c(`Label: ${label.width} x ${label.height} mm at origin X${fmt(originX)} Y${fmt(originY)}`));
  lines.push(c(`Machine: ${profile.name} (${dialect.name})`));
  lines.push(c('Engraving-first order: text, symbols, engrave shapes, then cut shapes last'));
  lines.push(...dialect.header(ctx));

  // 2. Spindle on, safe Z, feed rate
  lines.push(`G0 Z${fmt(profile.safeZ)}`);
  lines.push(`${profile.spindleOnCmd} S${fmt(profile.spindleSpeed)}`);
  lines.push(`F${fmt(profile.defaultFeedrate)}`);

  // 3. Engraving operations (order enforced by buildToolpath)
  for (const op of ops) {
    if (op.comment) lines.push(c(op.comment));
    const [first, ...rest] = op.points;
    lines.push(`G0 X${fmt(first.x)} Y${fmt(first.y)}`);
    lines.push(`G1 Z${fmt(-op.depth)} F${fmt(profile.defaultPlungeRate)}`);
    for (const p of rest) {
      lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)} F${fmt(profile.defaultFeedrate)}`);
    }
    lines.push(`G0 Z${fmt(profile.safeZ)}`);
  }

  // 4. Return to safe Z / home, spindle off
  lines.push(`G0 Z${fmt(profile.safeZ)}`);
  lines.push(`G0 X${fmt(profile.homeX)} Y${fmt(profile.homeY)}`);
  lines.push(profile.spindleOffCmd);

  // 5. Program end
  lines.push(...dialect.footer(ctx));

  return { gcode: lines.join('\n') + '\n', ops };
}

export type ValidationLevel = 'warning' | 'error';

export interface ValidationIssue {
  level: ValidationLevel;
  message: string;
}

/** Pre-export validation. Errors block export; warnings do not. */
export function validateJob(opts: GenerateOptions): ValidationIssue[] {
  const { label, profile, originX, originY } = opts;
  const issues: ValidationIssue[] = [];

  if (label.elements.length === 0) {
    issues.push({ level: 'error', message: 'Label has no elements — nothing to engrave.' });
  }

  for (const el of label.elements) {
    if (el.x < 0 || el.y < 0 || el.x + el.width > label.width || el.y + el.height > label.height) {
      const name =
        el.type === 'text'
          ? `Text "${el.text.split('\n')[0]}"`
          : el.type === 'symbol'
            ? `Symbol ${el.symbolName}`
            : `Shape ${el.shapeKind}`;
      issues.push({ level: 'warning', message: `${name} extends outside the label boundary.` });
    }
  }

  if (originX < 0 || originY < 0 || originX + label.width > profile.workAreaX || originY + label.height > profile.workAreaY) {
    issues.push({
      level: 'error',
      message: `Label plus origin exceeds the machine work area (${profile.workAreaX} x ${profile.workAreaY} mm).`,
    });
  }

  return issues;
}
