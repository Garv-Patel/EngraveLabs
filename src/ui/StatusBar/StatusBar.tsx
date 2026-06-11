import { useStore, selectActiveProfile } from '../../store';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  onOpenMachineDialog: () => void;
}

export function StatusBar({ onOpenMachineDialog }: StatusBarProps) {
  const profile = useStore(selectActiveProfile);
  const units = useStore((s) => s.project.units);
  const setUnits = useStore((s) => s.setUnits);
  const zoom = useStore((s) => s.zoom);

  return (
    <div className={styles.bar}>
      <span className={styles.item}>{profile.name}</span>
      <span className={styles.sep}>|</span>
      <span className={styles.item}>{profile.defaultFeedrate} mm/min</span>
      <span className={styles.sep}>|</span>
      <span className={styles.item}>{profile.engraveDepth} mm</span>
      <span className={styles.sep}>|</span>
      <span className={styles.item}>{profile.gcodeDialect}</span>
      <span className={styles.spacer} />
      <span className={styles.item}>{Math.round(zoom * 100)}%</span>
      <div className={styles.unitToggle}>
        <button className={units === 'mm' ? styles.active : ''} onClick={() => setUnits('mm')}>
          mm
        </button>
        <button className={units === 'inches' ? styles.active : ''} onClick={() => setUnits('inches')}>
          in
        </button>
      </div>
      <button className={styles.gearBtn} title="Machine profile" onClick={onOpenMachineDialog}>
        ⚙
      </button>
    </div>
  );
}
