/**
 * Tutorial progression: welcome → first-build → first-recruit → first-battle.
 */

export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    trigger: 'boot',
    title: 'Founding the Realm',
    text: 'Your village already stands — farms, timber, a barracks, and a host under your banner.\n\nStone and gold do not tick yet. Raise a Quarry on the rocky plot, then a Gold Mine on the hillside. The Map is where the real stores are won.',
  },
  {
    id: 'first-build',
    trigger: 'first-build',
    title: 'The First Foundations',
    text: 'Every building pays per second. Keep production ahead of the next age.\n\nTown Hall level gates the advance. Bronze Age wants Town Hall 2.',
  },
  {
    id: 'first-recruit',
    trigger: 'first-recruit',
    title: 'Mustering the Host',
    text: 'You already command stacks. Your hero\'s attack and defense are added to every one of them.\n\nReinforce from the Army tab, or take what you have onto the Map.',
  },
  {
    id: 'first-battle',
    trigger: 'first-battle',
    title: 'Holding the Line',
    text: 'Melee in front of shooters. Wait and Defend spend a turn; spells cost mana.\n\nIn a siege, place towers beside the road — never on it. Speed is on the top bar.',
  },
];

/**
 * If the active step matches `trigger`, return it; otherwise null.
 */
export function triggerTutorial(state, trigger) {
  if (!state?.tutorial || state.tutorial.done) return null;
  const seen = state.tutorial.seen || (state.tutorial.seen = []);
  if (TUTORIAL_STEPS.every((s) => seen.includes(s.id))) {
    state.tutorial.done = true;
    return null;
  }

  let stepIdx = state.tutorial.step || 0;
  while (stepIdx < TUTORIAL_STEPS.length && seen.includes(TUTORIAL_STEPS[stepIdx].id)) {
    stepIdx++;
  }
  state.tutorial.step = stepIdx;
  if (stepIdx >= TUTORIAL_STEPS.length) {
    state.tutorial.done = true;
    return null;
  }

  if (!seen.includes('welcome')) {
    return trigger === 'boot' ? TUTORIAL_STEPS[0] : null;
  }

  const current = TUTORIAL_STEPS[stepIdx];
  if (current && current.trigger === trigger && !seen.includes(current.id)) {
    return current;
  }

  return TUTORIAL_STEPS.slice(1).find((s) => s.trigger === trigger && !seen.includes(s.id)) || null;
}

export const checkTutorial = triggerTutorial;

export function tutorialPending(tutorial) {
  if (!tutorial || tutorial.done) return null;
  return TUTORIAL_STEPS[tutorial.step] || null;
}

/**
 * Advance tutorial.
 * - advanceTutorial(gameState, stepId) mutates state.tutorial
 * - advanceTutorial(tutorialObj, trigger) returns a new tutorial object (dispatch)
 */
export function advanceTutorial(stateOrTutorial, stepIdOrTrigger) {
  // Immutable tutorial-object form used by dispatch
  if (stateOrTutorial && typeof stateOrTutorial.step === 'number' && !stateOrTutorial.bld) {
    const tutorial = stateOrTutorial;
    if (!tutorial || tutorial.done) return tutorial;
    const cur = TUTORIAL_STEPS[tutorial.step];
    if (!cur) return tutorial;
    const triggerMatch = cur.trigger === stepIdOrTrigger || cur.id === stepIdOrTrigger;
    if (!triggerMatch) return tutorial;
    const seen = [...(tutorial.seen || []), cur.id];
    const next = tutorial.step + 1;
    if (next >= TUTORIAL_STEPS.length) return { ...tutorial, step: next, done: true, seen };
    return { ...tutorial, step: next, seen };
  }

  const state = stateOrTutorial;
  if (!state?.tutorial) return;
  state.tutorial.seen = state.tutorial.seen || [];
  const current = TUTORIAL_STEPS[state.tutorial.step || 0];
  const idToAdd = stepIdOrTrigger || current?.id;
  if (idToAdd && !state.tutorial.seen.includes(idToAdd)) {
    state.tutorial.seen.push(idToAdd);
  }
  while (
    state.tutorial.step < TUTORIAL_STEPS.length &&
    state.tutorial.seen.includes(TUTORIAL_STEPS[state.tutorial.step].id)
  ) {
    state.tutorial.step++;
  }
  if (
    state.tutorial.step >= TUTORIAL_STEPS.length ||
    TUTORIAL_STEPS.every((s) => state.tutorial.seen.includes(s.id))
  ) {
    state.tutorial.done = true;
  }
}

export function skipTutorial(state) {
  if (!state?.tutorial) return;
  state.tutorial.done = true;
}
