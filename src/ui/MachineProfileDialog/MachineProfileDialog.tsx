import { useState } from 'react';
import { useStore } from '../../store';
import { getBuiltinProfiles, isBuiltinProfile } from '../../machineProfiles/profileRegistry';
import type { MachineProfile, GcodeDialectId } from '../../machineProfiles/types';
import { Modal } from '../common/Modal';
import { showToast } from '../common/Toast';
import { downloadBlob, pickFile } from '../../utils/fileIO';
import styles from './MachineProfileDialog.module.css';

export function MachineProfileDialog({ onClose }: { onClose: () => void }) {
  const userProfiles = useStore((s) => s.userProfiles);
  const saveUserProfile = useStore((s) => s.saveUserProfile);
  const deleteUserProfile = useStore((s) => s.deleteUserProfile);
  const activeId = useStore((s) => s.project.machineProfileId);
  const setMachineProfileId = useStore((s) => s.setMachineProfileId);

  const allProfiles = [...getBuiltinProfiles(), ...userProfiles];
  const [selectedId, setSelectedId] = useState(activeId);
  const selected = allProfiles.find((p) => p.id === selectedId) ?? allProfiles[0];
  const builtin = isBuiltinProfile(selected.id);
  // Draft edits for the selected profile (user profiles only)
  const [draft, setDraft] = useState<MachineProfile>(selected);

  const select = (id: string) => {
    setSelectedId(id);
    setDraft(allProfiles.find((p) => p.id === id) ?? allProfiles[0]);
  };

  const duplicate = () => {
    const copy: MachineProfile = {
      ...selected,
      id: crypto.randomUUID(),
      name: `${selected.name} (copy)`,
    };
    saveUserProfile(copy);
    select(copy.id);
    showToast(`Created "${copy.name}"`);
  };

  const save = () => {
    saveUserProfile(draft);
    showToast(`Saved "${draft.name}"`);
  };

  const remove = () => {
    deleteUserProfile(selected.id);
    if (activeId === selected.id) setMachineProfileId(getBuiltinProfiles()[0].id);
    select(getBuiltinProfiles()[0].id);
  };

  const exportProfile = () => {
    downloadBlob(JSON.stringify(selected, null, 2), `${selected.name.replace(/\W+/g, '-')}.json`, 'application/json');
  };

  const importProfile = async () => {
    const file = await pickFile('.json');
    if (!file) return;
    try {
      const p = JSON.parse(file.text) as MachineProfile;
      if (!p.name || !p.gcodeDialect) throw new Error('missing fields');
      p.id = isBuiltinProfile(p.id) || allProfiles.some((x) => x.id === p.id) ? crypto.randomUUID() : p.id || crypto.randomUUID();
      saveUserProfile(p);
      select(p.id);
      showToast(`Imported "${p.name}"`);
    } catch {
      showToast(`"${file.name}" is not a valid machine profile.`, 'error');
    }
  };

  const num = (key: keyof MachineProfile, label: string, step = 0.1) => (
    <label className={styles.field} key={key}>
      <span>{label}</span>
      <input
        type="number"
        step={step}
        disabled={builtin}
        value={draft[key] as number}
        onChange={(e) => setDraft({ ...draft, [key]: parseFloat(e.target.value) || 0 })}
      />
    </label>
  );

  const text = (key: keyof MachineProfile, label: string) => (
    <label className={styles.field} key={key}>
      <span>{label}</span>
      <input
        type="text"
        disabled={builtin}
        value={draft[key] as string}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <Modal title="Machine profiles" onClose={onClose} wide>
      <div className={styles.layout}>
        <div className={styles.list}>
          {allProfiles.map((p) => (
            <button
              key={p.id}
              className={`${styles.listItem} ${p.id === selectedId ? styles.active : ''}`}
              onClick={() => select(p.id)}
            >
              {p.name}
              {isBuiltinProfile(p.id) && <em> built-in</em>}
              {p.id === activeId && <em> ● active</em>}
            </button>
          ))}
          <div className={styles.listActions}>
            <button onClick={duplicate}>Duplicate</button>
            <button onClick={importProfile}>Import</button>
            <button onClick={exportProfile}>Export</button>
            {!builtin && <button onClick={remove}>Delete</button>}
          </div>
        </div>

        <div className={styles.form}>
          {text('name', 'Name')}
          <label className={styles.field}>
            <span>G-code dialect</span>
            <select
              disabled={builtin}
              value={draft.gcodeDialect}
              onChange={(e) => setDraft({ ...draft, gcodeDialect: e.target.value as GcodeDialectId })}
            >
              <option value="grbl">Grbl</option>
              <option value="mach3">Mach3/4</option>
              <option value="linuxcnc">LinuxCNC</option>
            </select>
          </label>
          <div className={styles.grid}>
            {num('workAreaX', 'Work area X (mm)', 1)}
            {num('workAreaY', 'Work area Y (mm)', 1)}
            {num('defaultFeedrate', 'Feedrate (mm/min)', 10)}
            {num('defaultPlungeRate', 'Plunge rate (mm/min)', 10)}
            {num('spindleSpeed', 'Spindle speed (RPM)', 100)}
            {num('safeZ', 'Safe Z (mm)')}
            {num('engraveDepth', 'Engrave depth (mm)', 0.05)}
            {num('materialThickness', 'Material thickness (mm)', 0.1)}
            {num('topLayerDepth', 'Top layer depth (mm)', 0.05)}
            {num('toolDiameter', 'Tool diameter (mm)', 0.05)}
            {num('homeX', 'Home X (mm)', 1)}
            {num('homeY', 'Home Y (mm)', 1)}
          </div>
          <div className={styles.grid}>
            {text('spindleOnCmd', 'Spindle on')}
            {text('spindleOffCmd', 'Spindle off')}
            {text('programEndCmd', 'Program end')}
            {text('gcodeExtension', 'File extension')}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.secondaryBtn} onClick={() => setMachineProfileId(selected.id)}>
          Use this profile
        </button>
        {!builtin && (
          <button className={styles.primaryBtn} onClick={save}>
            Save changes
          </button>
        )}
      </div>
    </Modal>
  );
}
