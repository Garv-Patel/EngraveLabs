import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { saveProjectFile, parseProjectFile, pickFile } from '../../utils/fileIO';
import { showToast } from '../common/Toast';
import { loadPlugin, pluginMenuItems } from '../../plugins/loader';
import styles from './MenuBar.module.css';

interface MenuBarProps {
  onOpenExport: () => void;
  onOpenMachine: () => void;
  onOpenLabelSettings: () => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick: () => void;
  divider?: boolean;
}

export function MenuBar({ onOpenExport, onOpenMachine, onOpenLabelSettings }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);

  const s = () => useStore.getState();

  const openProject = async () => {
    const file = await pickFile('.elb,.json');
    if (!file) return;
    try {
      s().loadProject(parseProjectFile(file.text, file.name));
      window.dispatchEvent(new Event('engravelab:fit'));
      showToast(`Opened ${file.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const addPlugin = async () => {
    const url = window.prompt('Plugin module URL (ES module with a default EngravLabPlugin export):');
    if (!url) return;
    const result = await loadPlugin(url);
    if (result.ok) showToast('Plugin loaded.');
    else showToast(`Plugin failed to load: ${result.error}`, 'error');
  };

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'New project', onClick: () => s().newProject() },
      { label: 'Open…', shortcut: 'Ctrl+O', onClick: openProject },
      { label: 'Save as .elb', shortcut: 'Ctrl+S', onClick: () => saveProjectFile(s().project) },
      { label: 'Export G-code…', shortcut: 'Ctrl+E', onClick: onOpenExport, divider: true },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', onClick: () => s().undo() },
      { label: 'Redo', shortcut: 'Ctrl+Shift+Z', onClick: () => s().redo() },
      { label: 'Duplicate', shortcut: 'Ctrl+D', onClick: () => s().duplicateElements(s().selectedIds), divider: true },
      {
        label: 'Select all',
        shortcut: 'Ctrl+A',
        onClick: () => s().setSelection(s().project.label.elements.map((e) => e.id)),
      },
      { label: 'Delete selection', shortcut: 'Del', onClick: () => s().deleteElements(s().selectedIds) },
    ],
    View: [
      { label: 'Fit label to window', shortcut: 'Ctrl+Shift+H', onClick: () => window.dispatchEvent(new Event('engravelab:fit')) },
      { label: 'Zoom 100%', shortcut: 'Ctrl+0', onClick: () => s().setZoom(1) },
      { label: 'Toggle grid', onClick: () => s().setGridEnabled(!s().gridEnabled), divider: true },
      { label: 'Toggle dark mode', onClick: () => s().setTheme(s().theme === 'dark' ? 'light' : 'dark') },
    ],
    Machine: [
      { label: 'Machine profiles…', onClick: onOpenMachine },
      { label: 'Label settings…', onClick: onOpenLabelSettings },
    ],
    Help: [
      { label: 'Load plugin from URL…', onClick: addPlugin },
      {
        label: 'About EngraveLab',
        onClick: () => showToast('EngraveLab — engraving-first G-code generator for electrical labels.'),
      },
    ],
  };

  // Merge plugin-contributed menu items
  for (const item of pluginMenuItems) {
    (menus[item.menu] ??= []).push({ label: item.label, onClick: item.onClick });
  }

  // Global shortcuts for file operations
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        saveProjectFile(s().project);
      } else if (k === 'o') {
        e.preventDefault();
        void openProject();
      } else if (k === 'e') {
        e.preventDefault();
        onOpenExport();
      } else if (k === 'a' && !(e.target as HTMLElement).matches('input,textarea')) {
        e.preventDefault();
        s().setSelection(s().project.label.elements.map((el) => el.id));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOpenExport]);

  return (
    <div ref={barRef} className={styles.bar}>
      <span className={styles.brand}>EngraveLab</span>
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className={styles.menuWrap}>
          <button
            className={`${styles.menuBtn} ${openMenu === name ? styles.open : ''}`}
            onClick={() => setOpenMenu(openMenu === name ? null : name)}
            onPointerEnter={() => openMenu && setOpenMenu(name)}
          >
            {name}
          </button>
          {openMenu === name && (
            <div className={styles.dropdown}>
              {items.map((item, i) => (
                <div key={i}>
                  <button
                    className={styles.item}
                    onClick={() => {
                      setOpenMenu(null);
                      item.onClick();
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <kbd>{item.shortcut}</kbd>}
                  </button>
                  {item.divider && <div className={styles.divider} />}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
