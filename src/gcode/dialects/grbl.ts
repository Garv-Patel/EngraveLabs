import type { DialectDef } from './types';

export const grbl: DialectDef = {
  id: 'grbl',
  name: 'Grbl',
  comment: (text) => `(${text.replace(/[()]/g, '')})`,
  header: ({ profile }) => [
    'G21', // units: mm
    profile.coordMode === 'incremental' ? 'G91' : 'G90',
    'G17', // XY plane
    'G94', // feed per minute
  ],
  footer: ({ profile }) => [profile.programEndCmd],
};
