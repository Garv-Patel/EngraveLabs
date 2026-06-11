import { useState } from 'react';
import { useStore, type Tool } from '../../store';
import { listSymbols } from '../../symbols/symbolRegistry';
import { pluginToolbarItems } from '../../plugins/loader';
import styles from './Toolbar.module.css';

const TOOLS: { tool: Tool; label: string; icon: string; shortcut: string }[] = [
  { tool: 'select', label: 'Select', icon: '⮕', shortcut: 'V' },
  { tool: 'text', label: 'Text', icon: 'T', shortcut: 'T' },
  { tool: 'symbol', label: 'Symbol', icon: '⚠', shortcut: 'S' },
  { tool: 'border', label: 'Border', icon: '▣', shortcut: 'B' },
];

export function Toolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const gridEnabled = useStore((s) => s.gridEnabled);
  const setGridEnabled = useStore((s) => s.setGridEnabled);
  const pendingSymbolName = useStore((s) => s.pendingSymbolName);
  const setPendingSymbolName = useStore((s) => s.setPendingSymbolName);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);

  const onToolClick = (tool: Tool) => {
    setActiveTool(tool);
    setSymbolPickerOpen(tool === 'symbol' ? !symbolPickerOpen : false);
  };

  return (
    <div className={styles.toolbar}>
      {TOOLS.map(({ tool, label, icon, shortcut }) => (
        <button
          key={tool}
          className={`${styles.toolBtn} ${activeTool === tool ? styles.active : ''}`}
          title={`${label} (${shortcut})`}
          onClick={() => onToolClick(tool)}
        >
          {icon}
        </button>
      ))}
      <div className={styles.divider} />
      <button
        className={`${styles.toolBtn} ${gridEnabled ? styles.active : ''}`}
        title="Toggle grid snap"
        onClick={() => setGridEnabled(!gridEnabled)}
      >
        ⊞
      </button>
      <button
        className={styles.toolBtn}
        title="Fit label to window (Ctrl+Shift+H)"
        onClick={() => window.dispatchEvent(new Event('engravelab:fit'))}
      >
        ⊡
      </button>
      {pluginToolbarItems.map((item, i) => (
        <button key={i} className={styles.toolBtn} title={item.tooltip} onClick={item.onClick}>
          {item.icon}
        </button>
      ))}

      {symbolPickerOpen && activeTool === 'symbol' && (
        <div className={styles.symbolPicker}>
          <div className={styles.symbolPickerTitle}>Click canvas to place:</div>
          {listSymbols().map((sym) => (
            <button
              key={sym.name}
              className={`${styles.symbolItem} ${pendingSymbolName === sym.name ? styles.active : ''}`}
              onClick={() => {
                setPendingSymbolName(sym.name);
                setSymbolPickerOpen(false);
              }}
            >
              {sym.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
