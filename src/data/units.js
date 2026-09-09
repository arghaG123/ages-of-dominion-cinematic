export const ROLES = {
  melee: {
    n: 'Melee', ic: ['🪨', '🗡️', '🛡️', '⚔️', '🔫', '🪖', '🎖️'],
    names: ['Clubman', 'Axeman', 'Legionary', 'Man-at-Arms', 'Grenadier', 'Rifleman', 'Assault Trooper'],
    atk: 4, def: 5, hp: 11, dmin: 2, dmax: 4, spd: 5, rng: 0, shots: 0, block: 3,
    cost: { food: 45, gold: 10 },
  },
  ranged: {
    n: 'Shooter', ic: ['🪃', '🏹', '🎯', '🏹', '🔭', '🎯', '📡'],
    names: ['Slinger', 'Archer', 'Crossbowman', 'Longbowman', 'Musketeer', 'Sharpshooter', 'Marksman'],
    atk: 6, def: 3, hp: 8, dmin: 3, dmax: 5, spd: 4, rng: 6, shots: 14, block: 0,
    cost: { food: 30, wood: 25, gold: 15 },
  },
  heavy: {
    n: 'Heavy', ic: ['🦣', '🐎', '🐘', '🐴', '💣', '🚂', '🛡️'],
    names: ['Bone Crusher', 'Charioteer', 'War Elephant', 'Siege Knight', 'Cannon Crew', 'Steam Walker', 'Battle Tank'],
    atk: 8, def: 8, hp: 28, dmin: 6, dmax: 10, spd: 3, rng: 0, shots: 0, block: 2,
    cost: { food: 70, wood: 30, gold: 35 },
  },
};

export const CREATURES = {
  wolf:    { n: 'Dire Wolf',   ic: '🐺', t: 1, atk: 6,  def: 3,  hp: 10, dmin: 2,  dmax: 5,  spd: 7,  rng: 0, shots: 0,  block: 2, cost: { food: 40, gold: 35 } },
  bandit:  { n: 'Bandit',      ic: '🏴', t: 1, atk: 5,  def: 4,  hp: 12, dmin: 2,  dmax: 4,  spd: 5,  rng: 5, shots: 10, block: 1, cost: { food: 25, gold: 50 } },
  bear:    { n: 'Cave Bear',   ic: '🐻', t: 2, atk: 8,  def: 6,  hp: 26, dmin: 5,  dmax: 9,  spd: 4,  rng: 0, shots: 0,  block: 3, cost: { food: 80, gold: 70 } },
  harpy:   { n: 'Harpy',       ic: '🦅', t: 2, atk: 7,  def: 4,  hp: 16, dmin: 3,  dmax: 6,  spd: 8,  rng: 0, shots: 0,  block: 1, fly: 1, cost: { food: 50, gold: 90 } },
  golem:   { n: 'Stone Golem', ic: '🗿', t: 3, atk: 9,  def: 12, hp: 52, dmin: 7,  dmax: 12, spd: 3,  rng: 0, shots: 0,  block: 4, cost: { stone: 120, gold: 160 } },
  griffin: { n: 'Griffin',     ic: '🦁', t: 3, atk: 11, def: 9,  hp: 38, dmin: 6,  dmax: 14, spd: 9,  rng: 0, shots: 0,  block: 2, fly: 1, cost: { food: 120, gold: 180 } },
  wyvern:  { n: 'Wyvern',      ic: '🐉', t: 4, atk: 14, def: 12, hp: 70, dmin: 12, dmax: 20, spd: 9,  rng: 0, shots: 0,  block: 3, fly: 1, cost: { food: 200, gold: 320 } },
  drone:   { n: 'Drone Swarm', ic: '🛸', t: 4, atk: 13, def: 8,  hp: 44, dmin: 10, dmax: 16, spd: 10, rng: 8, shots: 16, block: 0, fly: 1, cost: { gold: 400, stone: 80 } },
};
