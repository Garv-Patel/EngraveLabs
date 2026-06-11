import type { AppContext, EngravLabPlugin } from './types';
import { registerFont } from '../fonts/fontRegistry';
import { registerSymbol } from '../symbols/symbolRegistry';
import { registerDialect } from '../gcode/generator';
import { useStore } from '../store';

export interface PluginMenuItem {
  menu: string;
  label: string;
  onClick: () => void;
}

export interface PluginToolbarItem {
  icon: string;
  tooltip: string;
  onClick: () => void;
}

/** Items contributed by plugins; the UI reads these on render. */
export const pluginMenuItems: PluginMenuItem[] = [];
export const pluginToolbarItems: PluginToolbarItem[] = [];

function createAppContext(): AppContext {
  return {
    registerFont,
    registerSymbol,
    registerGcodeDialect: registerDialect,
    registerMenuItem: (menu, label, onClick) => pluginMenuItems.push({ menu, label, onClick }),
    registerToolbarItem: (icon, tooltip, onClick) => pluginToolbarItems.push({ icon, tooltip, onClick }),
    getStore: () => useStore,
  };
}

/**
 * Load a plugin module from a URL the user provides. The module's default
 * export must implement EngravLabPlugin. Failures are reported, not fatal.
 */
export async function loadPlugin(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const mod = (await import(/* @vite-ignore */ url)) as { default?: EngravLabPlugin };
    if (!mod.default || typeof mod.default.register !== 'function') {
      return { ok: false, error: 'Module has no default export with a register() function.' };
    }
    mod.default.register(createAppContext());
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
