import type { SymbolDef } from './types';
import { warning } from './builtin/warning';
import { voltage } from './builtin/voltage';
import { noEntry } from './builtin/noEntry';

const symbols = new Map<string, SymbolDef>();

export function registerSymbol(symbol: SymbolDef): void {
  symbols.set(symbol.name, symbol);
}

export function getSymbol(name: string): SymbolDef | undefined {
  return symbols.get(name);
}

export function listSymbols(): SymbolDef[] {
  return [...symbols.values()];
}

registerSymbol(warning);
registerSymbol(voltage);
registerSymbol(noEntry);

export const DEFAULT_SYMBOL_NAME = 'warning';
