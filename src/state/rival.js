/**
 * Persistent named rival who remembers player choices across ages.
 */
import { pick, makeRng } from '../util.js';

const RIVAL_NAMES = [
  'Varek Iron-Eye', 'Malakor the Flayed', 'Thalric Ash-Bane',
  'Bran the Relentless', 'Karn Blood-Tide', 'Soren the Unforgiving',
];

const PORTRAITS = [
  'unit-knight.jpg',
  'unit-ranger.jpg',
  'unit-warlock.jpg',
];

export function initRival(seedOrRng) {
  const rng = typeof seedOrRng === 'function'
    ? seedOrRng
    : makeRng(seedOrRng ?? Date.now());
  return {
    name: pick(rng, RIVAL_NAMES),
    portrait: pick(rng, PORTRAITS),
    encounters: 0,
    defeated: 0,
    wounds: 0,
    /** Story flags this rival has witnessed. */
    flags: {},
    memory: [],
  };
}

export function getRival(state) {
  if (!state.rival) state.rival = initRival();
  return state.rival;
}

/** Remember a story flag the rival reacts to later. */
export function rivalRemember(rival, flag) {
  if (!rival) return;
  rival.flags = rival.flags || {};
  rival.flags[flag] = true;
  rival.memory = rival.memory || [];
  if (!rival.memory.includes(flag)) rival.memory.push(flag);
}

export function rivalSpeech(rival, flags = {}) {
  const merged = { ...(rival?.flags || {}), ...flags };
  const isFireShared = merged.generous;
  const isFireTaken = merged.ruthless;

  if ((rival.encounters || 0) === 0) {
    if (isFireShared) {
      return `“I remember that night at the first fire,” ${rival.name} sneers, stepping from the ranks. “You shared your hearth with shivering strangers. A pity kindness does not turn cold iron.”`;
    }
    if (isFireTaken) {
      return `“You took our flint and cast us into the cold,” ${rival.name} snarls. “We bled in the snow. Today your banner burns in return!”`;
    }
    return `“You think these hills belong to your banner?” ${rival.name} bellows, brandishing their weapon. “I will carve your line from the earth!”`;
  }

  if ((rival.defeated || 0) > 0) {
    if ((rival.wounds || 0) > 0) {
      return `“These scars you gave me ache,” ${rival.name} snarls, clutching their armor. “You broke my line before, but today the ground will drink your blood!”`;
    }
    return `“You broke my vanguard once before,” ${rival.name} spits. “This time you will not leave the field alive!”`;
  }

  return `“Back for another beating?” ${rival.name} laughs heartily. “You should have stayed in your village!”`;
}

export function rivalReact(rival, flags = {}) {
  return rivalSpeech(rival, flags);
}
