// The four ways a project can open from the notebook. Each project's
// `expansion` field picks one; the shell component lives in src/components/shells/.
export type ShellKind = 'folder' | 'scroll' | 'zine' | 'map';

export const SHELLS: Record<ShellKind, { noun: string; open: string }> = {
  folder: { noun: 'folder', open: 'Open the folder' },
  scroll: { noun: 'scroll', open: 'Unroll it' },
  zine: { noun: 'zine', open: 'Read the zine' },
  map: { noun: 'map', open: 'Unfold the map' },
};

export const shellOf = (k: ShellKind) => SHELLS[k];
