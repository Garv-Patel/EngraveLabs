import type { FontDef } from '../fonts/types';
import type { SymbolDef } from '../symbols/types';
import type { DialectDef } from '../gcode/dialects/types';
import type { useStore } from '../store';

export interface PluginManifest {
  name: string;
  version: string;
  entryPoint: string;
  provides: string[];
}

export type StoreAPI = typeof useStore;

export interface AppContext {
  registerFont(id: string, font: FontDef): void;
  registerSymbol(symbol: SymbolDef): void;
  registerGcodeDialect(dialect: DialectDef): void;
  registerMenuItem(menu: string, label: string, onClick: () => void): void;
  registerToolbarItem(icon: string, tooltip: string, onClick: () => void): void;
  getStore(): StoreAPI;
}

export interface EngravLabPlugin {
  register(app: AppContext): void;
}
