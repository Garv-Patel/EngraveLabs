import { useStore } from '../../store';
import { Modal } from '../common/Modal';
import { formatDisplay } from '../../utils/units';
import styles from './LabelSettingsDialog.module.css';

export function LabelSettingsDialog({ onClose }: { onClose: () => void }) {
  const label = useStore((s) => s.project.label);
  const units = useStore((s) => s.project.units);
  const setLabelName = useStore((s) => s.setLabelName);

  return (
    <Modal title="Label settings" onClose={onClose}>
      <label className={styles.field}>
        <span>Label name</span>
        <input type="text" value={label.name} onChange={(e) => setLabelName(e.target.value)} />
      </label>
      <div className={styles.note}>
        The label size follows the outermost cut shape — {formatDisplay(label.width, units)} ×{' '}
        {formatDisplay(label.height, units)}. Resize the outline on the canvas to change the part size.
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
