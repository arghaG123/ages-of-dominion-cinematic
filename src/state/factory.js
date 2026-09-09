/**
 * Fresh-game construction. Starting values match the prior factory; schema is v7.
 */
import { CLASSES, QUEST_TEMPLATES } from '../data/index.js';
import { uid } from '../util.js';
import { initRival } from './rival.js';

/** Save-schema version this build writes. */
export const SCHEMA_VERSION = 7;

export function newHero(cls, name) {
  const C = CLASSES[cls];
  return {
    name: name || 'Kael',
    cls,
    lvl: 1,
    xp: 0,
    pts: 0,
    atk: C.start.atk,
    def: C.start.def,
    pow: C.start.pow,
    kno: C.start.kno,
    mana: C.start.kno * 10,
    skills: {},
    spells: [C.spell, 'arrow'],
    equip: { weapon: null, armor: null, helm: null, boots: null, art1: null, art2: null },
    bag: [],
    mp: 5,
    mpMax: 5,
  };
}

export function newMeta() {
  return { playtime: 0, savedAt: 0, createdAt: Date.now() };
}

export function newGame(name, banner, cls) {
  cls = cls || 'knight';
  const heroName = (name && name !== 'Warlord') ? name : 'Kael';
  return {
    v: SCHEMA_VERSION,
    profile: {
      name: name || 'Warlord',
      banner: banner || 'banner',
      created: Date.now(),
      wins: 0,
      losses: 0,
      battles: 0,
      duels: 0,
    },
    age: 0,
    t: Date.now(),
    res: { food: 250, wood: 250, stone: 160, gold: 150 },
    bld: {
      townhall: { l: 1 },
      farm: { l: 1 },
      lumber: { l: 1 },
      quarry: { l: 0 },
      mine: { l: 0 },
      barracks: { l: 1 },
      workshop: { l: 1 },
      hall: { l: 0 },
      armory: { l: 0 },
      walls: { l: 1 },
    },
    army: [
      { id: uid(), kind: 'role', type: 'melee', age: 0, count: 12, rank: 0, xp: 0 },
      { id: uid(), kind: 'role', type: 'ranged', age: 0, count: 8, rank: 0, xp: 0 },
    ],
    towers: [
      { id: uid(), fam: 'arrow', tier: 0, rank: 0, xp: 0 },
      { id: uid(), fam: 'slow', tier: 0, rank: 0, xp: 0 },
    ],
    hero: newHero(cls, heroName),
    map: null,
    day: 1,
    story: { ch: 0, log: [], flags: {} },
    quests: JSON.parse(JSON.stringify(QUEST_TEMPLATES.slice(0, 3))),
    claimedMilestones: [],
    campaign: { cleared: 0 },
    endlessBest: 0,
    builds: [],
    rival: initRival(),
    tutorial: { step: 0, done: false, seen: [] },
    uiPrefs: { haptics: true, music: true, sfx: true },
    meta: newMeta(),
  };
}
