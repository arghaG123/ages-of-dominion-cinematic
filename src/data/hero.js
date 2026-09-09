export const PRIMARIES = [
  { k: 'atk', n: 'Attack',    ic: '⚔️', d: '+5% troop damage per point over enemy defense' },
  { k: 'def', n: 'Defense',   ic: '🛡️', d: '-2.5% damage taken per point over enemy attack (max 70%)' },
  { k: 'pow', n: 'Power',     ic: '✨', d: 'Scales spell damage, healing and duration' },
  { k: 'kno', n: 'Knowledge', ic: '📘', d: 'Mana = knowledge × 10' },
];

export const CLASSES = {
  knight: {
    n: 'Knight', ic: '🛡️', d: 'Might hero. Fast attack/defense growth, strong troops.',
    g: { atk: 0.35, def: 0.35, pow: 0.15, kno: 0.15 },
    start: { atk: 3, def: 3, pow: 1, kno: 1 }, spell: 'bless',
  },
  ranger: {
    n: 'Ranger', ic: '🏹', d: 'Balanced. Shooters and map movement.',
    g: { atk: 0.3, def: 0.2, pow: 0.25, kno: 0.25 },
    start: { atk: 2, def: 2, pow: 2, kno: 2 }, spell: 'haste',
  },
  warlock: {
    n: 'Warlock', ic: '🔮', d: 'Magic hero. Big spells, weaker troops.',
    g: { atk: 0.15, def: 0.15, pow: 0.35, kno: 0.35 },
    start: { atk: 1, def: 1, pow: 3, kno: 3 }, spell: 'arrow',
  },
};

export const SKILLS = {
  offense:    { n: 'Offense',    ic: '⚔️', d: '+10/20/30% melee damage' },
  archery:    { n: 'Archery',    ic: '🏹', d: '+10/25/50% shooter damage' },
  armorer:    { n: 'Armorer',    ic: '🛡️', d: '-5/10/15% damage taken' },
  wisdom:     { n: 'Wisdom',     ic: '📖', d: 'Unlocks level 2/3/4 spells' },
  leadership: { n: 'Leadership', ic: '🎺', d: '+1/2/3 morale (chance of extra turn)' },
  luck:       { n: 'Luck',       ic: '🍀', d: '+1/2/3 luck (chance of double damage)' },
  tactics:    { n: 'Tactics',    ic: '📐', d: '+1/2/3 deployment rows' },
  logistics:  { n: 'Logistics',  ic: '🥾', d: '+1/2/3 moves on the region map' },
  firstaid:   { n: 'First Aid',  ic: '⛑️', d: 'Recover 15/30/45% of losses after a won battle' },
};

export const SPELLS = {
  arrow:     { n: 'Magic Arrow',    ic: '🔸', lv: 1, mana: 5,  type: 'dmg',    f: p => 10 + 10 * p, d: '10 + 10×Power damage' },
  bless:     { n: 'Bless',          ic: '✨', lv: 1, mana: 5,  type: 'buff',                        d: 'Friendly stack always rolls max damage' },
  haste:     { n: 'Haste',          ic: '💨', lv: 1, mana: 6,  type: 'buff',                        d: '+3 speed to a friendly stack' },
  cure:      { n: 'Cure',           ic: '💚', lv: 1, mana: 6,  type: 'heal',   f: p => 10 + 10 * p, d: 'Heals 10 + 10×Power' },
  slow:      { n: 'Slow',           ic: '🐌', lv: 2, mana: 8,  type: 'debuff',                      d: '-3 speed to an enemy stack' },
  bolt:      { n: 'Lightning Bolt', ic: '⚡', lv: 2, mana: 10, type: 'dmg',    f: p => 10 + 25 * p, d: '10 + 25×Power damage' },
  fireball:  { n: 'Fireball',       ic: '🔥', lv: 3, mana: 14, type: 'aoe',    f: p => 10 + 20 * p, d: '10 + 20×Power to a stack and its neighbours' },
  resurrect: { n: 'Resurrection',   ic: '🕊️', lv: 4, mana: 20, type: 'res',    f: p => 50 * p,      d: 'Restores 50×Power HP of losses' },
};
