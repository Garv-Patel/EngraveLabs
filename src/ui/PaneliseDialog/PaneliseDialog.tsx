import { useMemo, useState } from 'react';
import { useStore, selectActiveProfile } from '../../store';
import { generatePanelGcode, findOuterCutShape, type PanelStrategy } from '../../gcode/paneliser';
import { estimateJobSeconds, formatDuration } from '../../gcode/estimator';
import { downloadGcode } from '../../utils/fileIO';
import { Modal } from '../common/Modal';
import { NumberField } from '../common/NumberField';
import { showToast } from '../common/Toast';
import styles from '../ExportDialog/ExportDialog.module.css';

const PREVIEW_LINES = 50;

const STRATEGY_LABEL: Record<PanelStrategy, string> = {
  'grid-shared': 'shared-edge grid (minimum cuts: adjacent labels share a single cut line)',
  hex: 'hexagonal packing (circles touch; cut individually)',
  grid: 'grid packing (tiles touch edge-to-edge; cut individually)',
};

export function PaneliseDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const profile = useStore(selectActiveProfile);

  const [sheetW, setSheetW] = useState(profile.workAreaX);
  const [sheetH, setSheetH] = useState(profile.workAreaY);
  const [originX, setOriginX] = useState(0);
  const [originY, setOriginY] = useState(0);

  const outer = findOuterCutShape(project.label);

  const result = useMemo(
    () =>
      outer
        ? generatePanelGcode({ label: project.label, profile, sheetW, sheetH, originX, originY })
        : null,
    [project.label, profile, sheetW, sheetH, originX, originY, outer],
  );

  const errors: string[] = [];
  if (!outer) {
    errors.push('No cut shape on the label. Add a shape and set its mode to "Cut through" to define the outline.');
  } else if (!result) {
    errors.push(
      `The outline (${outer.width} x ${outer.height} mm) does not fit the available sheet (${sheetW} x ${sheetH} mm).`,
    );
  }
  if (originX < 0 || originY < 0 || originX + sheetW > profile.workAreaX || originY + sheetH > profile.workAreaY) {
    errors.push(
      `Sheet plus origin exceeds the machine work area (${profile.workAreaX} x ${profile.workAreaY} mm).`,
    );
  }
  const blocked = errors.length > 0;

  const previewLines = result ? result.gcode.split('\n') : [];
  const preview = result
    ? previewLines.slice(0, PREVIEW_LINES).join('\n') +
      (previewLines.length > PREVIEW_LINES ? `\n... (${previewLines.length - PREVIEW_LINES} more lines)` : '')
    : '';

  const onDownload = () => {
    if (!result) return;
    downloadGcode(result.gcode, `${project.label.name}-panel-${result.plan.count}x`, profile.gcodeExtension);
    showToast(`Exported panel of ${result.plan.count} labels`);
    onClose();
  };

  return (
    <Modal title="Panelise & export" onClose={onClose} wide>
      <div className={styles.originRow}>
        <NumberField label="Available sheet width" value={sheetW} min={1} onChange={setSheetW} />
        <NumberField label="Available sheet height" value={sheetH} min={1} onChange={setSheetH} />
      </div>
      <div className={styles.originRow}>
        <NumberField label="Sheet origin X on bed" value={originX} min={0} onChange={setOriginX} />
        <NumberField label="Sheet origin Y on bed" value={originY} min={0} onChange={setOriginY} />
        <div className={styles.estimate}>
          <span>Estimated time</span>
          <strong>{result ? formatDuration(estimateJobSeconds(result.ops, profile)) : '—'}</strong>
        </div>
      </div>

      {result && (
        <div className={styles.warning}>
          {result.plan.count} labels — {result.plan.cols} × {result.plan.rows},{' '}
          {STRATEGY_LABEL[result.plan.strategy]}. Labels pack from the origin corner; leftover stock stays on the
          far sides.
        </div>
      )}
      {errors.map((e, i) => (
        <div key={i} className={styles.error}>
          {e}
        </div>
      ))}

      {result && <textarea className={styles.preview} readOnly value={preview} spellCheck={false} />}

      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button className={styles.downloadBtn} disabled={blocked || !result} onClick={onDownload}>
          Download .{profile.gcodeExtension}
        </button>
      </div>
    </Modal>
  );
}
