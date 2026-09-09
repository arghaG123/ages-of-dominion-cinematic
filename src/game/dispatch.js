import { AGES, BUILDINGS, ROLES, CLASSES, STORY, QUEST_TEMPLATES, TERRAIN, WEATHER, CREATURES } from '../data/index.js';
import {
  rates, bcost, canPay, pay, ageUpCost, calcAgeUpPrompt, armySlots, scaleCost, blOf,
} from '../rules/economy.js';
import { startBuild, resolveBuilds, hasBuildInProgress } from '../rules/builds.js';
import { calculateOfflineProgress } from '../state/offline.js';
import { advanceTutorial } from '../state/tutorial.js';
import { unitStats } from '../rules/units.js';
import { calcHostPower, encounterVerdict, verdictLabel } from '../rules/encounters.js';
import { resolveBattle, encodeChallenge, decodeChallenge, replayChallenge } from '../rules/combat.js';
import { resolveSiege } from '../rules/siege.js';
import { uid, makeRng, pick } from '../util.js';

/**
 * Single mutation entry point.
 * @param {object} state
 * @param {{ type: string, [key: string]: any }} action
 * @returns {{ state: object, effects: object[] }}
 */
export function dispatch(state, action) {
  const effects = [];
  if (!state || !action?.type) return { state, effects: [{ type: 'error', message: 'bad-action' }] };

  switch (action.type) {
    case 'tick': {
      const now = action.now || Date.now();
      let next = state;
      const built = resolveBuilds(next, now);
      next = built.state;
      for (const job of built.completed) {
        effects.push({ type: 'build-complete', buildingId: job.buildingId });
      }
      const dt = Math.min(2, Math.max(0, (now - (next.t || now)) / 1000));
      if (dt > 0) {
        const r = rates(next.bld);
        const res = { ...next.res };
        for (const k of Object.keys(r)) res[k] = (res[k] || 0) + r[k] * dt;
        next = { ...next, res, t: now };
      } else {
        next = { ...next, t: now };
      }
      return { state: next, effects };
    }

    case 'offline': {
      const result = calculateOfflineProgress(state, action.now || Date.now());
      if (result.grant) effects.push({ type: 'offline-grant', grant: result.grant });
      return { state: result.state, effects };
    }

    case 'build': {
      const id = action.buildingId;
      if (!BUILDINGS[id]) return refuse(state, effects, 'Unknown building');
      if (hasBuildInProgress(state, id)) return refuse(state, effects, 'Already building');
      const lvl = blOf(state.bld, id);
      const cost = bcost(id, lvl);
      if (!canPay(state.res, cost)) return refuse(state, effects, 'Cannot afford');
      let next = { ...state, res: pay(state.res, cost) };
      next = startBuild(next, id);
      next = { ...next, tutorial: advanceTutorial(next.tutorial, 'first-build') };
      effects.push({ type: 'build-started', buildingId: id }, { type: 'haptic', kind: 'upgrade' }, { type: 'sfx', kind: 'upgrade' });
      return { state: next, effects };
    }

    case 'age-up': {
      if (state.age >= 6) return refuse(state, effects, 'Final age');
      const prompt = calcAgeUpPrompt(state.age, blOf(state.bld, 'townhall'), state.res, ageUpCost(state.age));
      if (!prompt.ready) return refuse(state, effects, prompt.sub);
      const cost = ageUpCost(state.age);
      let next = { ...state, res: pay(state.res, cost), age: state.age + 1 };
      next.army = next.army.map((s) => (s.kind === 'role' ? { ...s, age: next.age } : s));
      if (next.story.ch < STORY.length && next.age > next.story.ch) {
        effects.push({ type: 'chapter', index: next.story.ch });
      }
      effects.push({ type: 'age-up', age: next.age }, { type: 'haptic', kind: 'ageup' }, { type: 'sfx', kind: 'ageup' });
      return { state: next, effects };
    }

    case 'recruit': {
      const type = action.unitType || 'melee';
      const role = ROLES[type];
      if (!role) return refuse(state, effects, 'Unknown unit');
      if (!action.forceNew) {
        const match = state.army.find((s) => s.kind === 'role' && s.type === type && s.age === state.age && (s.rank || 0) === 0);
        if (match) {
          return dispatch(state, { type: 'reinforce', stackId: match.id });
        }
      }
      if (state.army.length >= armySlots(state.bld)) return refuse(state, effects, 'Roster full');
      const cost = scaleCost(role.cost, state.age);
      if (!canPay(state.res, cost)) return refuse(state, effects, 'Cannot afford');
      const stack = { id: uid(), kind: 'role', type, age: state.age, count: 5, rank: 0, xp: 0 };
      const next = {
        ...state,
        res: pay(state.res, cost),
        army: [...state.army, stack],
        tutorial: advanceTutorial(state.tutorial, 'first-recruit'),
      };
      effects.push({ type: 'recruited', stack }, { type: 'haptic', kind: 'recruit' }, { type: 'sfx', kind: 'recruit' });
      return { state: next, effects };
    }

    case 'reinforce': {
      const stack = state.army.find((s) => s.id === action.stackId);
      if (!stack || stack.kind !== 'role') return refuse(state, effects, 'No stack');
      const role = ROLES[stack.type];
      const cost = scaleCost(role.cost, state.age);
      if (!canPay(state.res, cost)) return refuse(state, effects, 'Cannot afford');
      const army = state.army.map((s) => (s.id === stack.id ? { ...s, count: s.count + 5 } : s));
      effects.push({ type: 'reinforced', stackId: stack.id });
      return { state: { ...state, res: pay(state.res, cost), army }, effects };
    }

    case 'story-choice': {
      const ch = STORY[state.story.ch];
      if (!ch) return refuse(state, effects, 'No chapter');
      const choice = ch.ch[action.index];
      if (!choice) return refuse(state, effects, 'Bad choice');
      const res = { ...state.res };
      for (const k in (choice.fx || {})) res[k] = (res[k] || 0) + choice.fx[k];
      const flags = { ...state.story.flags, [choice.flag]: true };
      const log = [...state.story.log, choice.log];
      effects.push({ type: 'story', flag: choice.flag });
      return {
        state: {
          ...state,
          res,
          story: { ch: state.story.ch + 1, log, flags },
        },
        effects,
      };
    }

    case 'gen-map': {
      return { state: { ...state, map: genMap(state) }, effects };
    }

    case 'travel': {
      const map = state.map;
      if (!map) return refuse(state, effects, 'No map');
      const node = map.nodes[action.nodeIndex];
      if (!node) return refuse(state, effects, 'Bad node');
      if (!map.links[map.at]?.includes(action.nodeIndex)) return refuse(state, effects, 'Not linked');
      if ((state.hero.mp || 0) <= 0) return refuse(state, effects, 'No moves');
      const hero = { ...state.hero, mp: state.hero.mp - 1 };
      const nextMap = { ...map, at: action.nodeIndex };
      effects.push({ type: 'arrived', node });
      return { state: { ...state, hero, map: nextMap }, effects };
    }

    case 'resolve-node': {
      return resolveNodeAction(state, effects, action);
    }

    case 'apply-battle-result': {
      const result = action.result;
      let next = { ...state, profile: { ...state.profile, battles: (state.profile.battles || 0) + 1 } };
      if (result.winner === 'p') {
        next.profile = { ...next.profile, wins: (next.profile.wins || 0) + 1 };
        next.tutorial = advanceTutorial(next.tutorial, 'first-battle');
        effects.push({ type: 'victory' }, { type: 'haptic', kind: 'kill' }, { type: 'sfx', kind: 'kill' });
      } else {
        next.profile = { ...next.profile, losses: (next.profile.losses || 0) + 1 };
        effects.push({ type: 'defeat' });
      }
      if (action.armyAfter) next.army = action.armyAfter;
      return { state: next, effects };
    }

    case 'set-pref': {
      return {
        state: { ...state, uiPrefs: { ...state.uiPrefs, [action.key]: action.value } },
        effects,
      };
    }

    case 'end-day': {
      const r = rates(state.bld);
      const res = { ...state.res };
      for (const k of Object.keys(r)) res[k] = (res[k] || 0) + r[k] * 180;
      const weatherKeys = Object.keys(WEATHER);
      const weather = weatherKeys[Math.floor(Math.random() * weatherKeys.length)];
      let map = state.map;
      if (map && Math.random() < 0.6) {
        map = {
          ...map,
          nodes: map.nodes.map((n) => (n.cleared && n.type === 'creature' ? { ...n, cleared: false } : n)),
        };
      }
      return { state: { ...state, res, day: state.day + 1, map, weather }, effects: [{ type: 'day', day: state.day + 1 }] };
    }

    default:
      return refuse(state, effects, `Unknown action ${action.type}`);
  }
}

function refuse(state, effects, message) {
  effects.push({ type: 'toast', message });
  return { state, effects };
}

export function genMap(state, seed = (state.day || 1) * 997 + (state.age || 0) * 13) {
  const rng = makeRng(seed);
  const cols = 3, rows = 7;
  const nodes = [];
  const types = ['creature', 'resource', 'dwelling', 'event', 'treasure', 'ambush', 'garrison', 'creature', 'boss'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = nodes.length;
      const terrainKeys = Object.keys(TERRAIN);
      const terrain = terrainKeys[Math.floor(rng() * terrainKeys.length)];
      let type = 'town';
      if (!(r === 0 && c === 1)) type = types[Math.floor(rng() * types.length)];
      if (r === rows - 1 && c === 1) type = 'boss';
      const node = {
        id: i, x: 0.18 + c * 0.32 + (rng() - 0.5) * 0.04,
        y: 0.12 + r * 0.12, type, terrain, cleared: false,
      };
      if (type === 'creature' || type === 'boss') {
        const foes = makeFoes(state.age, type === 'boss', rng);
        node.foes = foes;
        node.power = foes.reduce((a, s) => a + (s.count * 12), 0);
      }
      if (type === 'resource') node.reward = { [pick(rng, ['food', 'wood', 'stone', 'gold'])]: 40 + state.age * 20 };
      nodes.push(node);
    }
  }
  const links = nodes.map(() => []);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c < cols - 1) { links[i].push(i + 1); links[i + 1].push(i); }
      if (r < rows - 1) { links[i].push(i + cols); links[i + cols].push(i); }
    }
  }
  return { cols, rows, nodes, links, at: 1, seed };
}

function makeFoes(age, boss, rng) {
  const keys = Object.keys(CREATURES).filter((k) => CREATURES[k].t <= Math.min(4, 1 + Math.floor(age / 2) + (boss ? 1 : 0)));
  const type = keys[Math.floor(rng() * keys.length)] || 'wolf';
  const count = boss ? 8 + age * 2 : 4 + age;
  return [{ id: uid(), kind: 'creature', type, age, count, rank: 0, xp: 0 }];
}

function resolveNodeAction(state, effects, action) {
  const map = state.map;
  const node = map?.nodes?.[map.at];
  if (!node || node.cleared) return refuse(state, effects, 'Nothing here');

  if (node.type === 'town') {
    const hero = { ...state.hero, mp: heroMovesSafe(state), mana: 999 };
    // mana capped later by UI; restore feel
    hero.mana = (state.hero.kno || 1) * 10;
    const nodes = map.nodes.map((n, i) => (i === map.at ? { ...n, cleared: true } : n));
    effects.push({ type: 'toast', message: 'Resupplied in town.' });
    return { state: { ...state, hero, map: { ...map, nodes } }, effects };
  }

  if (node.type === 'resource' && node.reward) {
    const res = { ...state.res };
    for (const k in node.reward) res[k] = (res[k] || 0) + node.reward[k];
    const nodes = map.nodes.map((n, i) => (i === map.at ? { ...n, cleared: true } : n));
    effects.push({ type: 'toast', message: 'Caches claimed.' });
    return { state: { ...state, res, map: { ...map, nodes } }, effects };
  }

  if (node.type === 'creature' || node.type === 'boss') {
    effects.push({ type: 'start-fight', foes: node.foes, boss: node.type === 'boss', nodeIndex: map.at });
    return { state, effects };
  }

  if (node.type === 'ambush' || node.type === 'garrison') {
    effects.push({ type: 'start-siege', mode: 'site', nodeIndex: map.at });
    return { state, effects };
  }

  const nodes = map.nodes.map((n, i) => (i === map.at ? { ...n, cleared: true } : n));
  effects.push({ type: 'toast', message: 'The road is quiet.' });
  return { state: { ...state, map: { ...map, nodes } }, effects };
}

function heroMovesSafe(state) {
  return 5 + (state.hero.skills?.logistics || 0);
}

export function nextAction(state) {
  if (!state) return { title: 'Begin', sub: 'Start a realm' };
  if ((state.builds || []).length) {
    return { title: 'Building…', sub: 'Scaffolding at work' };
  }
  if (blOf(state.bld, 'quarry') === 0) return { title: 'Build Quarry', sub: 'Stone for the ages', action: { type: 'build', buildingId: 'quarry' } };
  if (state.army.length < 3) return { title: 'Recruit', sub: 'Muster the host', tab: 'host' };
  if (!state.map) return { title: 'Open Map', sub: 'Walk the region', tab: 'map' };
  return { title: 'Fight', sub: 'Clear the next camp', tab: 'map' };
}

export function hostPower(state) {
  return calcHostPower(state.army, state.hero);
}

export {
  calcAgeUpPrompt, AGES, BUILDINGS, CLASSES, unitStats,
  encounterVerdict, verdictLabel, resolveBattle, resolveSiege,
  encodeChallenge, decodeChallenge, replayChallenge, rates, bcost, canPay,
};
