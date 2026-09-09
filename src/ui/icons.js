/** Custom engraved-style SVG icons — no emoji in production UI. */

const PATHS = {
  food: 'M8 20c4-8 4-12 0-16 6 2 10 8 10 16H8zm8 0c0-8 4-14 10-16-4 4-4 8 0 16h-10z',
  wood: 'M16 4l4 8-4 2-4-2 4-8zm-2 12l2 8h4l2-8-4-2-4 2z',
  stone: 'M6 22l-2-8 6-8 8 4 4 8-6 4H6z',
  gold: 'M16 4c6 0 10 4 10 10s-4 12-10 12S4 26 4 14 10 4 16 4zm0 4c-4 0-6 3-6 6s2 8 6 8 6-5 6-8-2-6-6-6z',
  realm: 'M4 24V10l12-6 12 6v14H4zm8-4h4v4h-4v-4zm8 0h4v4h-4v-4zM12 12h4v4h-4v-4z',
  host: 'M16 4a6 6 0 110 12 6 6 0 010-12zM6 28c2-6 6-8 10-8s8 2 10 8H6z',
  map: 'M4 6l8 3 8-4 8 3v18l-8-3-8 4-8-3V6zm8 5v14m8-16v14',
  war: 'M8 6l4 4-2 2 8 8 2-2 4 4-6 2-10-10-2 2-4-4 2-2-4-4zm12 0l8 8-2 2-8-8 2-2z',
  more: 'M8 16a2 2 0 110.001 0M16 16a2 2 0 110.001 0M24 16a2 2 0 110.001 0',
  attack: 'M6 26L20 6l6 2-4 8 4 2-10 10-4-4 2-4z',
  defend: 'M16 4l10 4v8c0 7-5 12-10 14C11 28 6 23 6 16V8l10-4z',
  move: 'M16 4v20m0 0l-6-6m6 6l6-6M6 28h20',
  wait: 'M16 6a10 10 0 100 20 10 10 0 000-20zm0 4v6l4 3',
  spell: 'M16 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z',
  build: 'M6 26V14l10-8 10 8v12H6zm6-8h8v8h-8v-8z',
  recruit: 'M10 18a5 5 0 1110 0 5 5 0 01-10 0zM4 28c1-5 5-7 12-7s11 2 12 7H4z',
  age: 'M4 24c4-10 8-16 12-18 4 2 8 8 12 18H4zm6-4h12',
  mute: 'M6 12h4l6-6v20l-6-6H6V12zm16 1l5 5m0-5l-5 5',
  heal: 'M14 6h4v8h8v4h-8v8h-4v-8H6v-4h8V6z',
  fire: 'M16 4s8 8 8 14a8 8 0 11-16 0c0-4 4-8 8-14z',
  ice: 'M16 2v28M6 8l20 16M26 8L6 24M4 16h24',
  arrow: 'M4 16h20m0 0l-6-6m6 6l-6 6',
  smoke: 'M8 24c0-4 3-6 6-6 1-3 4-5 8-4 3 0 6 3 6 7 0 4-3 7-8 7H12c-3 0-4-2-4-4z',
  quest: 'M10 4h12v6c0 4-3 6-6 8v2h-2v-3c4-2 6-4 6-7V6H12v4H10V4zm6 20h2v4h-2v-4z',
  rival: 'M8 8l4-4h8l4 4v6l-4 10H12L8 14V8zm8 4a3 3 0 100 6 3 3 0 000-6z',
};

const ALIASES = {
  food: 'food', wood: 'wood', stone: 'stone', gold: 'gold',
};

export function iconIdFromEmoji(ic) {
  return ALIASES[ic] || null;
}

export function iconMarkup(id, opts = {}) {
  const key = PATHS[id] ? id : (iconIdFromEmoji(id) || 'more');
  const size = opts.size || 20;
  const label = opts.label || key;
  const d = PATHS[key] || PATHS.more;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 32 32" role="img" aria-label="${label}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

export function paintNavIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const id = el.getAttribute('data-icon');
    el.innerHTML = iconMarkup(id, { size: 22, label: id });
  });
}

export { PATHS as ICON_PATHS };
