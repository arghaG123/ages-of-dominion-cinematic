export const SLOTS = [
  { k: 'weapon', n: 'Weapon',   ic: '⚔️' },
  { k: 'armor',  n: 'Armor',    ic: '🥋' },
  { k: 'helm',   n: 'Helm',     ic: '⛑️' },
  { k: 'boots',  n: 'Boots',    ic: '🥾' },
  { k: 'art1',   n: 'Artifact', ic: '💍' },
  { k: 'art2',   n: 'Artifact', ic: '📿' },
];

export const GEAR = {
  weapon: { ic: '⚔️', main: 'atk',  names: ['Flint Club', 'Bronze Sword', 'Iron Gladius', "Knight's Longsword", 'Flintlock Brace', 'Repeating Carbine', 'Pulse Rifle'] },
  armor:  { ic: '🥋', main: 'def',  names: ['Hide Wrap', 'Bronze Cuirass', 'Iron Lorica', 'Plate Harness', 'Musketeer Coat', 'Riveted Vest', 'Composite Plate'] },
  helm:   { ic: '⛑️', main: 'kno',  names: ['Bone Circlet', 'Bronze Helm', 'Iron Sallet', 'Great Helm', 'Tricorn Hat', 'Field Cap', 'Combat Visor'] },
  boots:  { ic: '🥾', main: 'move', names: ['Hide Wraps', 'Leather Sandals', 'Studded Caligae', 'Steel Sabatons', 'Riding Boots', 'Marching Boots', 'Assault Boots'] },
};

export const QUAL = [
  { n: 'Crude',  m: 1 },
  { n: 'Fine',   m: 1.8 },
  { n: 'Master', m: 2.8 },
  { n: 'Relic',  m: 4 },
];

export const ARTIFACTS = {
  wolfamulet: { n: 'Amulet of the Wolf', ic: '🐺', b: { morale: 2 },                d: '+2 morale' },
  bloodstone: { n: 'Bloodstone',         ic: '🔴', b: { atk: 3 },                   d: '+3 attack' },
  aegis:      { n: 'Aegis Shard',        ic: '🔷', b: { def: 3 },                   d: '+3 defense' },
  codex:      { n: "Sage's Codex",       ic: '📜', b: { kno: 4 },                   d: '+4 knowledge' },
  orb:        { n: 'Orb of Storms',      ic: '🔮', b: { pow: 3 },                   d: '+3 power' },
  clover:     { n: 'Iron Clover',        ic: '🍀', b: { luck: 2 },                  d: '+2 luck' },
  lens:       { n: 'Eagle Eye Lens',     ic: '🔭', b: { shootBon: 0.25 },           d: '+25% shooter damage' },
  vitality:   { n: 'Ring of Vitality',   ic: '💍', b: { hpBon: 0.15 },              d: '+15% troop HP' },
  swiftboots: { n: 'Winged Spurs',       ic: '🪶', b: { spdBon: 2 },                d: '+2 speed to all stacks' },
  banner:     { n: 'Ancient Banner',     ic: '🚩', b: { morale: 1, atk: 1, def: 1 }, d: '+1 morale, attack, defense' },
};
