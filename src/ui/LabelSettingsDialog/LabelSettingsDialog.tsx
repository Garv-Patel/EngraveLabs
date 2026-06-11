import { useStore } from '../../store';
import { Modal } from '../common/Modal';
import { NumberField } from '../common/NumberField';
import styles from './LabelSettingsDialog.module.css';

export function LabelSettingsDialog({ onClose }: { onClose: () => void }) {
  const label = useStore((s) => s.project.label);
  const setLabelSize = useStore((s) => s.setLabelSize);
  const setLabelName = useStore((s) => s.setLabelName);
  const updateElement = useStore((s) => s.updateElement);

  const resize = (width: number, height: number) => {
    setLabelSize(width, height);
    // The border element tracks the label dimensions
    const border = label.elements.find((el) => el.type === 'border');
    if (border) updateElement(border.id, { width, height });
  };

  return (
    <Modal title="Label settings" onClose={onClose}>
      <label className={styles.field}>
        <span>Label name</span>
        <input type="text" value={label.name} onChange={(e) => setLabelName(e.target.value)} />
      </label>
      <div className={styles.row}>
        <NumberField label="Width" value={label.width} min={5} onChange={(v) => resize(v, label.height)} />
        <NumberField label="Height" value={label.height} min={5} onChange={(v) => resize(label.width, v)} />
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
