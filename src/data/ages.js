/**
 * Age progression, rank ladder and resource kinds.
 * Value-identical to the cinematic rebuild reference export from the prior build.
 * Presentation icons are resolved via src/ui/icons.js — `ic` fields remain for parity.
 */
export const AGES = [
  { n: 'Stone Age', ic: '🪨' },
  { n: 'Bronze Age', ic: '🗡️' },
  { n: 'Iron Age', ic: '⚒️' },
  { n: 'Medieval Age', ic: '🏰' },
  { n: 'Gunpowder Age', ic: '💣' },
  { n: 'Industrial Age', ic: '⚙️' },
  { n: 'Modern Age', ic: '🚀' },
];

export const RANKS = [
  { n: 'RECRUIT', c: '#9aa4b2' },
  { n: 'VETERAN', c: '#5ec27a' },
  { n: 'ELITE', c: '#4aa8ff' },
  { n: 'CHAMPION', c: '#b06bff' },
  { n: 'LEGEND', c: '#f0a92e' },
];

export const RANKXP = [0, 60, 180, 420, 900];

export const RES = [
  { k: 'food', ic: '🍖', n: 'Food' },
  { k: 'wood', ic: '🪵', n: 'Wood' },
  { k: 'stone', ic: '🪨', n: 'Stone' },
  { k: 'gold', ic: '🪙', n: 'Gold' },
];
