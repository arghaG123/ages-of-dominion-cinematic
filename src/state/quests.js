/**
 * Quest progress sync — auto-grants rewards on completion and rotates
 * the active trio when all three are done.
 */
import { QUEST_TEMPLATES } from '../data/story.js';

function questMet(state, q) {
  switch (q.need) {
    case 'wins':
      return (state.profile?.wins || 0) >= q.v;
    case 'age':
      return (state.age || 0) >= q.v;
    case 'creature':
      return (state.army || []).some((s) => s.kind === 'creature');
    case 'rank':
      return (state.army || []).some((s) => (s.rank || 0) >= q.v)
        || (state.towers || []).some((t) => (t.rank || 0) >= q.v);
    case 'gear': {
      const eq = state.hero?.equip || {};
      return ['weapon', 'armor', 'helm', 'boots'].filter((k) => eq[k]).length >= q.v;
    }
    case 'best':
      return (state.endlessBest || 0) >= q.v;
    default:
      return false;
  }
}

/**
 * Check active quests, grant rw when newly completed, toast, and rotate
 * when all active quests are done.
 * @param {object} state
 * @param {object[]} [effects]
 * @returns {object} next state
 */
export function syncQuests(state, effects = []) {
  if (!state?.quests?.length) return state;

  let res = state.res;
  let resChanged = false;
  const quests = state.quests.map((q) => ({ ...q }));
  let anyNew = false;

  for (const q of quests) {
    if (q.done) continue;
    if (!questMet(state, q)) continue;
    q.done = true;
    anyNew = true;
    if (!resChanged) {
      res = { ...state.res };
      resChanged = true;
    }
    for (const k in (q.rw || {})) res[k] = (res[k] || 0) + q.rw[k];
    effects.push({ type: 'toast', message: `Quest complete: ${q.n}` });
  }

  let nextQuests = quests;
  let doneQuestIds = state.doneQuestIds || [];

  if (quests.every((q) => q.done)) {
    const used = new Set([...doneQuestIds, ...quests.map((q) => q.id)]);
    const fresh = QUEST_TEMPLATES
      .filter((t) => !used.has(t.id))
      .slice(0, 3)
      .map((t) => JSON.parse(JSON.stringify(t)));
    if (fresh.length) {
      doneQuestIds = [...used];
      nextQuests = fresh;
      anyNew = true;
    }
  }

  if (!anyNew) return state;
  const out = { ...state, quests: nextQuests };
  if (resChanged) out.res = res;
  if (doneQuestIds !== state.doneQuestIds) out.doneQuestIds = doneQuestIds;
  return out;
}
