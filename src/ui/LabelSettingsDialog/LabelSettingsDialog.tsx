import { useStore } from '../../store';
import { Modal } from '../common/Modal';
import { formatDisplay } from '../../utils/units';
import { partBBox } from '../../gcode/toolpath';
import styles from './LabelSettingsDialog.module.css';

export function LabelSettingsDialog({ onClose }: { onClose: () => void }) {
  const label = useStore((s) => s.project.label);
  const units = useStore((s) => s.project.units);
  const setLabelName = useStore((s) => s.setLabelName);
  const part = partBBox(label);

  return (
    <Modal title="Label settings" onClose={onClose}>
      <label className={styles.field}>
        <span>Label name</span>
        <input type="text" value={label.name} onChange={(e) => setLabelName(e.target.value)} />
      </label>
      <div className={styles.note}>
        The part is the outermost cut shape — {formatDisplay(part.width, units)} × {formatDisplay(part.height, units)}.
        Resize that outline on the canvas to change the part size; the background shows the full machine work area.
      </div>
      <label className={styles.field}>
        <span>Preview colour</span>
        <input
          type="color"
          value={label.backgroundColor}
          onChange={(e) =>
            useStore.setState((s) => ({
              project: { ...s.project, label: { ...s.project.label, backgroundColor: e.target.value } },
            }))
          }
        />
      </label>
    </Modal>
  );
}
