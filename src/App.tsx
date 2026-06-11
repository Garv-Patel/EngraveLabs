import { useEffect, useState } from 'react';
import { useStore } from './store';
import { CanvasView } from './canvas/CanvasView';
import { MenuBar } from './ui/MenuBar/MenuBar';
import { Toolbar } from './ui/Toolbar/Toolbar';
import { PropertiesPanel } from './ui/PropertiesPanel/PropertiesPanel';
import { StatusBar } from './ui/StatusBar/StatusBar';
import { ExportDialog } from './ui/ExportDialog/ExportDialog';
import { PaneliseDialog } from './ui/PaneliseDialog/PaneliseDialog';
import { MachineProfileDialog } from './ui/MachineProfileDialog/MachineProfileDialog';
import { LabelSettingsDialog } from './ui/LabelSettingsDialog/LabelSettingsDialog';
import { ToastHost } from './ui/common/Toast';
import styles from './App.module.css';

type Dialog = 'export' | 'panelise' | 'machine' | 'label' | null;

export default function App() {
  const [dialog, setDialog] = useState<Dialog>(null);
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className={styles.app}>
      <MenuBar
        onOpenExport={() => setDialog('export')}
        onOpenPanelise={() => setDialog('panelise')}
        onOpenMachine={() => setDialog('machine')}
        onOpenLabelSettings={() => setDialog('label')}
      />
      <div className={styles.main}>
        <Toolbar />
        <CanvasView />
        <PropertiesPanel />
      </div>
      <StatusBar onOpenMachineDialog={() => setDialog('machine')} />

      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
      {dialog === 'panelise' && <PaneliseDialog onClose={() => setDialog(null)} />}
      {dialog === 'machine' && <MachineProfileDialog onClose={() => setDialog(null)} />}
      {dialog === 'label' && <LabelSettingsDialog onClose={() => setDialog(null)} />}
      <ToastHost />
    </div>
  );
}
