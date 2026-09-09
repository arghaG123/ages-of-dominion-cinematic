/**
 * Milestone progress + claim. Definitions live in data/story.js.
 */
import { MILESTONES } from '../data/story.js';
import { armySlots, blOf } from '../rules/economy.js';

export { MILESTONES };

function meets(state, m) {
  switch (m.need) {
    case 'quarry':
      return blOf(state.bld, 'quarry') >= (m.v || 1);
    case 'wins':
      return (state.profile?.wins || 0) >= (m.v || 1);
    case 'age':
      return (state.age || 0) >= (m.v || 1);
    case 'roster': {
      const slots = armySlots(state.bld);
      const n = (state.army || []).length;
      return n >= slots || n >= 4;
    }
    case 'siege':
      return (state.endlessBest || 0) >= 1 || (state.profile?.sieges || 0) >= 1;
    case 'rival':
      return (state.rival?.encounters || 0) >= 1;
    case 'final':
      return (state.age || 0) >= 6 || !!state.story?.flags?.final;
    default:
      return false;
  }
}

/** Newly claimable (met, not yet claimed) milestone ids. */
export function checkMilestones(state) {
  const claimed = state?.claimedMilestones || [];
  return MILESTONES
    .filter((m) => !claimed.includes(m.id) && meets(state, m))
    .map((m) => m.id);
}

/**
 * Claim a met milestone; grants rw into res.
 * @returns {{ state: object, ok: boolean, milestone?: object }}
 */
export function claimMilestone(state, id) {
  const m = MILESTONES.find((x) => x.id === id);
  if (!m) return { state, ok: false };
  const claimed = state.claimedMilestones || [];
  if (claimed.includes(id) || !meets(state, m)) return { state, ok: false };
  const res = { ...state.res };
  for (const k in (m.rw || {})) res[k] = (res[k] || 0) + m.rw[k];
  return {
    state: {
      ...state,
      res,
      claimedMilestones: [...claimed, id],
    },
    ok: true,
    milestone: m,
  };
}
