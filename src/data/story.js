export const STORY = [
  {
    t: 'Chapter I — The First Fire',
    d: 'Your people huddle in a cave mouth while something wet and heavy moves in the dark outside. You have flint, forty spears, and a name people will follow.\n\nThe fire is small. It will not last both the night and the strangers at the treeline.',
    ch: [
      { t: 'Share the fire', fx: { food: 120 }, flag: 'generous', log: 'You shared the first fire. The strangers stayed, and they remembered.' },
      { t: 'Take their flint by force', fx: { gold: 100, stone: 120 }, flag: 'ruthless', log: 'You took the flint. The strangers did not stay, but your stores grew.' },
    ],
  },
  {
    t: 'Chapter II — Metal and Debt',
    d: 'The smelters work day and night. A trader from downriver offers a shipment on credit, with terms you cannot read.',
    ch: [
      { t: 'Sign the terms', fx: { wood: 400, stone: 400 }, flag: 'indebted', log: 'The bronze arrived. So did the debt.' },
      { t: 'Mine your own', fx: { food: 250 }, flag: 'independent', log: 'You dug your own ore. Slower, but yours.' },
    ],
  },
  {
    t: 'Chapter III — The Iron Road',
    d: 'Iron changes what a border means. Scouts return with maps of three valleys and the names of the warlords who hold them.',
    ch: [
      { t: 'Fortify the passes', fx: { stone: 600 }, flag: 'defender', log: 'You chose walls over marches.' },
      { t: 'Strike the nearest warlord', fx: { gold: 500 }, flag: 'conqueror', log: 'You struck first, and the valley learned your banner.' },
    ],
  },
  {
    t: 'Chapter IV — Crown and Keep',
    d: 'They call you sovereign now, mostly to your face. The old families want a council; your captains want a throne.',
    ch: [
      { t: 'Seat a council', fx: { food: 800, wood: 800 }, flag: 'council', log: 'A council sits. Slower decisions, deeper roots.' },
      { t: 'Take the throne alone', fx: { gold: 900 }, flag: 'crown', log: 'You took the crown alone. No one argued twice.' },
    ],
  },
  {
    t: 'Chapter V — Powder and Consequence',
    d: 'A monk brings you a jar of black grain that turns stone into gravel. Walls that took a century to raise now have a countdown on them.',
    ch: [
      { t: 'Arm the towers with it', fx: { gold: 1200 }, flag: 'gunline', log: 'Your towers speak thunder now.' },
      { t: 'Bury the recipe', fx: { food: 1500, stone: 1200 }, flag: 'cautious', log: 'You buried it. Someone else will dig it up.' },
    ],
  },
  {
    t: 'Chapter VI — Smoke Over the Valley',
    d: 'Rail and furnace. Your realm fields in a week what once took a season.',
    ch: [
      { t: 'Push production to the limit', fx: { gold: 2500, stone: 2000 }, flag: 'industry', log: 'The furnaces never cooled.' },
      { t: 'Protect the old valleys', fx: { food: 3000 }, flag: 'green', log: 'You spared the valleys. Your rivals did not.' },
    ],
  },
  {
    t: 'Chapter VII — The Modern Crown',
    d: 'Satellites, not scouts. Your hero — once a spear-carrier at a cave mouth — commands from a screen. One banner on the map is still not yours.',
    ch: [
      { t: 'End it', fx: { gold: 5000 }, flag: 'final', log: 'The last banner came down. The age is yours.' },
    ],
  },
];

export const QUEST_TEMPLATES = [
  { id: 'q1', n: 'Win your first battle',      need: 'wins',     v: 1,  done: false, rw: { gold: 120 } },
  { id: 'q2', n: 'Reach the Bronze Age',       need: 'age',      v: 1,  done: false, rw: { gold: 200, stone: 150 } },
  { id: 'q3', n: 'Recruit a wild creature',    need: 'creature', v: 1,  done: false, rw: { food: 200, gold: 150 } },
  { id: 'q4', n: 'Rank a stack to Veteran',    need: 'rank',     v: 1,  done: false, rw: { gold: 250 } },
  { id: 'q5', n: 'Equip a full set of gear',   need: 'gear',     v: 4,  done: false, rw: { gold: 400 } },
  { id: 'q6', n: 'Survive 10 endless waves',   need: 'best',     v: 10, done: false, rw: { gold: 500, stone: 300 } },
];

/** Achievement milestones (claim via claim-milestone). */
export const MILESTONES = [
  { id: 'first_quarry', n: 'First Quarry', need: 'quarry', v: 1, rw: { stone: 100, gold: 50 } },
  { id: 'first_battle', n: 'First Victory', need: 'wins', v: 1, rw: { gold: 120 } },
  { id: 'bronze_age', n: 'Bronze Age', need: 'age', v: 1, rw: { gold: 200, stone: 150 } },
  { id: 'full_roster', n: 'Full Roster', need: 'roster', v: 1, rw: { food: 150, gold: 100 } },
  { id: 'first_siege', n: 'First Siege', need: 'siege', v: 1, rw: { stone: 200, gold: 150 } },
  { id: 'rival_met', n: 'Rival Met', need: 'rival', v: 1, rw: { gold: 250 } },
  { id: 'modern_crown', n: 'Modern Crown', need: 'final', v: 1, rw: { gold: 5000, stone: 2000 } },
];
