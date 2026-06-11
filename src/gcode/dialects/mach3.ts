import type { DialectDef } from './types';

export const mach3: DialectDef = {
  id: 'mach3',
  name: 'Mach3/4',
  comment: (text) => `(${text.replace(/[()]/g, '')})`,
  header: ({ profile }) => [
    'G21',
    profile.coordMode === 'incremental' ? 'G91' : 'G90',
    'G17',
    'G94',
    'G40', // cutter compensation off
    'G49', // tool length offset off
  ],
  footer: ({ profile }) => [profile.programEndCmd],
};
