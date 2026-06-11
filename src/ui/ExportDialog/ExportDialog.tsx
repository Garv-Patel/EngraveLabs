import { useMemo } from 'react';
import { useStore } from '../../store';
import { getBuiltinProfiles } from '../../machineProfiles/profileRegistry';
import { generateGcode, validateJob } from '../../gcode/generator';
import { estimateJobSeconds, formatDuration } from '../../gcode/estimator';
import { downloadGcode } from '../../utils/fileIO';
import { Modal } from '../common/Modal';
import { NumberField } from '../common/NumberField';
import { showToast } from '../common/Toast';
import styles from './ExportDialog.module.css';

const PREVIEW_LINES = 50;

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const userProfiles = useStore((s) => s.userProfiles);
  const setMachineProfileId = useStore((s) => s.setMachineProfileId);
  const setCanvasOrigin = useStore((s) => s.setCanvasOrigin);

  const allProfiles = [...getBuiltinProfiles(), ...userProfiles];
  const profile = allProfiles.find((p) => p.id === project.machineProfileId) ?? allProfiles[0];

  const { result, issues, estimate } = useMemo(() => {
    const opts = {
      label: project.label,
      profile,
      originX: project.canvasOriginX,
      originY: project.canvasOriginY,
    };
    const issues = validateJob(opts);
    const result = generateGcode(opts);
    return { result, issues, estimate: estimateJobSeconds(result.ops, profile) };
  }, [project, profile]);

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const blocked = errors.length > 0;
  const previewLines = result.gcode.split('\n');
  const preview =
    previewLines.slice(0, PREVIEW_LINES).join('\n') +
    (previewLines.length > PREVIEW_LINES ? `\n... (${previewLines.length - PREVIEW_LINES} more lines)` : '');

  const onDownload = () => {
    downloadGcode(result.gcode, project.label.name, profile.gcodeExtension);
    showToast(`Exported ${project.label.name}.${profile.gcodeExtension}`);
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

      <textarea className={styles.preview} readOnly value={preview} spellCheck={false} />

      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button
          className={styles.downloadBtn}
          disabled={blocked || project.label.elements.length === 0}
          onClick={onDownload}
        >
          Download .{profile.gcodeExtension}
        </button>
      </div>
    </Modal>
  );
}
