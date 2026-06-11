import type { DialectDef } from './types';

export const linuxcnc: DialectDef = {
  id: 'linuxcnc',
  name: 'LinuxCNC',
  comment: (text) => `; ${text}`,
  header: ({ profile }) => [
    'G21',
    profile.coordMode === 'incremental' ? 'G91' : 'G90',
    'G17',
    'G94',
    'G40',
    'G49',
    'G54', // first work coordinate system
  ],
  footer: ({ profile }) => [profile.programEndCmd],
};
