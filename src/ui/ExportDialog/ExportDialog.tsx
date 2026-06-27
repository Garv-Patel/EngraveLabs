import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { getBuiltinProfiles } from '../../machineProfiles/profileRegistry';
import { generateGcode, validateJob } from '../../gcode/generator';
import { generatePanelGcode, findOuterCutShape, type PanelStrategy } from '../../gcode/paneliser';
import { estimateJobSeconds, formatDuration } from '../../gcode/estimator';
import { downloadGcode } from '../../utils/fileIO';
import { Modal } from '../common/Modal';
import { NumberField } from '../common/NumberField';
import { showToast } from '../common/Toast';
import styles from './ExportDialog.module.css';

const PREVIEW_LINES = 50;

const STRATEGY_LABEL: Record<PanelStrategy, string> = {
  'grid-shared': 'shared-edge grid (minimum cuts: adjacent labels share a single cut line)',
  hex: 'hexagonal packing (circles touch; cut individually)',
  grid: 'grid packing (tiles touch edge-to-edge; cut individually)',
};

function clampPreview(gcode: string): string {
  const lines = gcode.split('\n');
  return (
    lines.slice(0, PREVIEW_LINES).join('\n') +
    (lines.length > PREVIEW_LINES ? `\n... (${lines.length - PREVIEW_LINES} more lines)` : '')
  );
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const userProfiles = useStore((s) => s.userProfiles);
  const setMachineProfileId = useStore((s) => s.setMachineProfileId);
  const setCanvasOrigin = useStore((s) => s.setCanvasOrigin);

  const allProfiles = [...getBuiltinProfiles(), ...userProfiles];
  const profile = allProfiles.find((p) => p.id === project.machineProfileId) ?? allProfiles[0];

  // Panelising tiles the label across a stock sheet. It needs a cut outline to
  // tile, so it is only offered once the label has one.
  const outer = findOuterCutShape(project.label);
  const [panelise, setPanelise] = useState(false);
  const [sheetW, setSheetW] = useState(profile.workAreaX);
  const [sheetH, setSheetH] = useState(profile.workAreaY);

  const job = useMemo(() => {
    if (panelise) {
      const result = outer
        ? generatePanelGcode({
            label: project.label,
            profile,
            sheetW,
            sheetH,
            originX: project.canvasOriginX,
            originY: project.canvasOriginY,
          })
        : null;
      const errors: string[] = [];
      if (!outer) {
        errors.push('Panelising needs a cut outline. Add a shape and set its mode to "Cut through".');
      } else if (!result) {
        errors.push(
          `The outline (${outer.width} x ${outer.height} mm) does not fit the available sheet (${sheetW} x ${sheetH} mm).`,
        );
      }
      if (
        project.canvasOriginX < 0 ||
        project.canvasOriginY < 0 ||
        project.canvasOriginX + sheetW > profile.workAreaX ||
        project.canvasOriginY + sheetH > profile.workAreaY
      ) {
        errors.push(
          `Sheet plus origin exceeds the machine work area (${profile.workAreaX} x ${profile.workAreaY} mm).`,
        );
      }
      return {
        gcode: result?.gcode ?? '',
        ops: result?.ops ?? [],
        plan: result?.plan ?? null,
        errors: errors.map((message) => ({ level: 'error' as const, message })),
      };
    }

    const opts = {
      label: project.label,
      profile,
      originX: project.canvasOriginX,
      originY: project.canvasOriginY,
    };
    const result = generateGcode(opts);
    return { gcode: result.gcode, ops: result.ops, plan: null, errors: validateJob(opts) };
  }, [panelise, outer, project, profile, sheetW, sheetH]);

  const errors = job.errors.filter((i) => i.level === 'error');
  const warnings = job.errors.filter((i) => i.level === 'warning');
  const blocked = errors.length > 0 || project.label.elements.length === 0 || job.gcode === '';
  const estimate = job.ops.length > 0 ? estimateJobSeconds(job.ops, profile) : 0;

  const onDownload = () => {
    if (blocked) return;
    if (panelise && job.plan) {
      downloadGcode(job.gcode, `${project.label.name}-panel-${job.plan.count}x`, profile.gcodeExtension);
      showToast(`Exported panel of ${job.plan.count} labels`);
    } else {
      downloadGcode(job.gcode, project.label.name, profile.gcodeExtension);
      showToast(`Exported ${project.label.name}.${profile.gcodeExtension}`);
    }
    onClose();
  };

  return (
    <Modal title="Export G-code" onClose={onClose} wide>
      <label className={styles.field}>
        <span>Machine profile</span>
        <select value={profile.id} onChange={(e) => setMachineProfileId(e.target.value)}>
          {allProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.originRow}>
        <NumberField
          label="Origin X on bed"
          value={project.canvasOriginX}
          min={0}
          onChange={(v) => setCanvasOrigin(v, project.canvasOriginY)}
        />
        <NumberField
          label="Origin Y on bed"
          value={project.canvasOriginY}
          min={0}
          onChange={(v) => setCanvasOrigin(project.canvasOriginX, v)}
        />
        <div className={styles.estimate}>
          <span>Estimated time</span>
          <strong>{formatDuration(estimate)}</strong>
        </div>
      </div>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={panelise}
          disabled={!outer}
          onChange={(e) => setPanelise(e.target.checked)}
        />
        <span>
          Panelise across a stock sheet
          {!outer && <em> — add a cut outline to enable</em>}
        </span>
      </label>

      {panelise && (
        <div className={styles.originRow}>
          <NumberField label="Available sheet width" value={sheetW} min={1} onChange={setSheetW} />
          <NumberField label="Available sheet height" value={sheetH} min={1} onChange={setSheetH} />
        </div>
      )}

      {panelise && job.plan && (
        <div className={styles.warning}>
          {job.plan.count} labels — {job.plan.cols} × {job.plan.rows}, {STRATEGY_LABEL[job.plan.strategy]}. Labels
          pack from the origin corner; leftover stock stays on the far sides.
        </div>
      )}

      {errors.map((e, i) => (
        <div key={i} className={styles.error}>
          {e.message}
        </div>
      ))}
      {warnings.map((w, i) => (
        <div key={i} className={styles.warning}>
          {w.message}
        </div>
      ))}

      <textarea className={styles.preview} readOnly value={clampPreview(job.gcode)} spellCheck={false} />

      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button className={styles.downloadBtn} disabled={blocked} onClick={onDownload}>
          Download .{profile.gcodeExtension}
        </button>
      </div>
    </Modal>
  );
}
