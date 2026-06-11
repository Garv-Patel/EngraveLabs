import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { displayToMm, mmToDisplay } from '../../utils/units';
import styles from './common.module.css';

interface NumberFieldProps {
  label: string;
  /** Value in mm (or raw number when `raw` is set). */
  value: number;
  onChange: (mmValue: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Skip unit conversion (e.g. pass counts, RPM). */
  raw?: boolean;
  disabled?: boolean;
}

/** Numeric input that displays in the project unit but stores mm. */
export function NumberField({ label, value, onChange, min, max, step, raw, disabled }: NumberFieldProps) {
  const units = useStore((s) => s.project.units);
  const display = raw ? value : mmToDisplay(value, units);
  const rounded = Math.round(display * 1000) / 1000;
  const [text, setText] = useState(String(rounded));

  useEffect(() => {
    setText(String(rounded));
  }, [rounded]);

  const commit = (t: string) => {
    const parsed = parseFloat(t);
    if (Number.isNaN(parsed)) {
      setText(String(rounded));
      return;
    }
    let mm = raw ? parsed : displayToMm(parsed, units);
    if (min !== undefined) mm = Math.max(min, mm);
    if (max !== undefined) mm = Math.min(max, mm);
    onChange(mm);
  };

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {!raw && <em> ({units === 'inches' ? 'in' : 'mm'})</em>}
      </span>
      <input
        type="number"
        value={text}
        step={step ?? (units === 'inches' && !raw ? 0.01 : 0.1)}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
      />
    </label>
  );
}
