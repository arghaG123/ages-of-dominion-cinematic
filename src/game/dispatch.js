import {
  AGES, BUILDINGS, ROLES, CLASSES, STORY, QUEST_TEMPLATES, TERRAIN, WEATHER,
  CREATURES, GEAR, QUAL, SKILLS, PRIMARIES,
} from '../data/index.js';
import {
  rates, bcost, canPay, pay, ageUpCost, calcAgeUpPrompt, armySlots, scaleCost, blOf,
} from '../rules/economy.js';
import { startBuild, resolveBuilds, hasBuildInProgress } from '../rules/builds.js';
import { calculateOfflineProgress } from '../state/offline.js';
import { advanceTutorial, TUTORIAL_STEPS } from '../state/tutorial.js';
import { unitStats, rankFromXp } from '../rules/units.js';
import { calcHostPower, encounterVerdict, verdictLabel } from '../rules/encounters.js';
import { resolveBattle, encodeChallenge, decodeChallenge, replayChallenge } from '../rules/combat.js';
import { resolveSiege } from '../rules/siege.js';
import { uid, makeRng, pick } from '../util.js';
import { syncQuests } from '../state/quests.js';
import { checkMilestones, claimMilestone } from '../state/milestones.js';
import { rivalRemember } from '../state/rival.js';
import {
  townResupply, cacheExtra, treasureExtra, dwellingOffer, scaleOfferCost,
  refugeeEvent, withSpoils, survivorJoin, hideGold, choiceToast,
} from '../state/storyFlags.js';

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
      if (built.completed.length) next = withProgress(next, effects);
      return { state: next, effects };
    }

    case 'offline': {
      const result = calculateOfflineProgress(state, action.now || Date.now());
      if (result.grant) effects.push({ type: 'offline-grant', grant: result.grant });
      return { state: withProgress(result.state, effects), effects };
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
      next = withTutorial(next, 'first-build', effects);
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
      next = withProgress(next, effects);
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
      let next = {
        ...state,
        res: pay(state.res, cost),
        army: [...state.army, stack],
      };
      next = withTutorial(next, 'first-recruit', effects);
      next = withProgress(next, effects);
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
      const rival = rememberRival(state.rival, choice.flag);
      effects.push({ type: 'story', flag: choice.flag });
      effects.push({ type: 'toast', message: choiceToast(choice.flag) });
      let next = {
        ...state,
        res,
        rival,
        story: { ch: state.story.ch + 1, log, flags },
      };
      next = withProgress(next, effects);
      return { state: next, effects };
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
      let next = { ...state, hero, map: nextMap };
      next = withTutorial(next, 'first-travel', effects);
      effects.push({ type: 'arrived', node });
      return { state: next, effects };
    }

    case 'resolve-node': {
      return resolveNodeAction(state, effects, action);
    }

    case 'apply-battle-result': {
      return applyBattleResult(state, effects, action);
    }

    case 'apply-siege-result': {
      const result = action.result || {};
      let next = {
        ...state,
        profile: {
          ...state.profile,
          sieges: (state.profile?.sieges || 0) + 1,
        },
      };
      if (result.won) {
        next = {
          ...next,
          res: { ...next.res, gold: (next.res.gold || 0) + (result.gold || 0) },
          endlessBest: Math.max(next.endlessBest || 0, result.waves || 0),
        };
        if (action.nodeIndex != null && next.map?.nodes) {
          const nodes = next.map.nodes.map((n, i) => (
            i === action.nodeIndex ? { ...n, cleared: true } : n
          ));
          next = { ...next, map: { ...next.map, nodes } };
        }
        effects.push({ type: 'victory' }, { type: 'toast', message: `Siege held — wave ${result.waves || 0}` });
      } else {
        effects.push({ type: 'defeat' }, { type: 'toast', message: 'The core fell' });
      }
      next = withProgress(next, effects);
      return { state: next, effects };
    }

    case 'tutorial-ack': {
      let next = withTutorial(state, action.id || action.trigger || 'welcome', effects);
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

    case 'forge': {
      const slot = action.slot;
      if (!GEAR[slot]) return refuse(state, effects, 'Bad slot');
      const armory = blOf(state.bld, 'armory');
      if (armory < 1) return refuse(state, effects, 'Build an Armory');
      const q = Math.min(3, Math.max(0, Math.floor((armory - 1) / 2)));
      const mul = (state.age + 1) * (q + 1);
      const cost = { wood: 80 * mul, stone: 60 * mul, gold: 70 * mul };
      if (!canPay(state.res, cost)) return refuse(state, effects, 'Cannot afford');
      const item = makeGear(slot, state.age, q);
      const hero = { ...state.hero, bag: [...(state.hero.bag || []), item] };
      effects.push({ type: 'toast', message: `Forged ${item.name}` }, { type: 'sfx', kind: 'upgrade' });
      return { state: { ...state, res: pay(state.res, cost), hero }, effects };
    }

    case 'equip': {
      const bag = [...(state.hero.bag || [])];
      const idx = action.index != null ? action.index : bag.findIndex((it) => it.id === action.itemId);
      if (idx < 0 || idx >= bag.length) return refuse(state, effects, 'No item');
      const item = bag[idx];
      bag.splice(idx, 1);
      const equip = { ...state.hero.equip };
      const slot = item.art ? (equip.art1 ? (equip.art2 ? 'art1' : 'art2') : 'art1') : item.slot;
      if (!slot || !(slot in equip)) return refuse(state, effects, 'Bad equip slot');
      if (equip[slot]) bag.push(equip[slot]);
      equip[slot] = item;
      let next = { ...state, hero: { ...state.hero, bag, equip } };
      next = withProgress(next, effects);
      effects.push({ type: 'equipped', slot, item });
      return { state: next, effects };
    }

    case 'spend-stat': {
      const k = action.stat;
      if (!PRIMARIES.some((p) => p.k === k)) return refuse(state, effects, 'Bad stat');
      if ((state.hero.pts || 0) <= 0) return refuse(state, effects, 'No points');
      const hero = {
        ...state.hero,
        pts: state.hero.pts - 1,
        [k]: (state.hero[k] || 0) + 1,
      };
      if (k === 'kno') hero.mana = hero.kno * 10;
      effects.push({ type: 'toast', message: `+1 ${PRIMARIES.find((p) => p.k === k).n}` });
      return { state: { ...state, hero }, effects };
    }

    case 'learn-skill': {
      const key = action.skill;
      if (!SKILLS[key]) return refuse(state, effects, 'Unknown skill');
      if ((state.hero.pts || 0) <= 0) return refuse(state, effects, 'No points');
      const cur = state.hero.skills?.[key] || 0;
      if (cur >= 3) return refuse(state, effects, 'Max skill');
      const hero = {
        ...state.hero,
        pts: state.hero.pts - 1,
        skills: { ...state.hero.skills, [key]: cur + 1 },
      };
      effects.push({ type: 'toast', message: `${SKILLS[key].n} improved` });
      return { state: { ...state, hero }, effects };
    }

    case 'market-trade': {
      if ((state.age || 0) < 1) return refuse(state, effects, 'Market unlocks in the Bronze Age');
      const from = action.from;
      const to = action.to;
      if (!from || !to || from === to) return refuse(state, effects, 'Bad trade');
      if ((state.res[from] || 0) < 100) return refuse(state, effects, `Need 100 ${from}`);
      const res = { ...state.res, [from]: state.res[from] - 100, [to]: (state.res[to] || 0) + 80 };
      effects.push({ type: 'toast', message: `Traded 100 ${from} for 80 ${to}` }, { type: 'sfx', kind: 'coin' });
      return { state: { ...state, res }, effects };
    }

    case 'hire-dwelling': {
      return hireDwelling(state, effects, action);
    }

    case 'event-choice': {
      return resolveEventChoice(state, effects, action);
    }

    case 'claim-milestone': {
      const result = claimMilestone(state, action.id);
      if (!result.ok) return refuse(state, effects, 'Cannot claim');
      effects.push({ type: 'toast', message: `Milestone: ${result.milestone.n}` }, { type: 'sfx', kind: 'coin' });
      return { state: result.state, effects };
    }

    case 'rival-duel': {
      if (!state.army?.some((s) => s.count > 0)) return refuse(state, effects, 'No troops');
      const rival = {
        ...(state.rival || {}),
        encounters: ((state.rival?.encounters) || 0) + 1,
      };
      const foes = makeFoes(state.age, true, makeRng(Date.now()));
      effects.push({
        type: 'start-fight',
        foes,
        boss: true,
        rival: true,
        reward: withSpoils(state.story?.flags || {}, { gold: 200 + state.age * 80 }),
      });
      let next = withProgress({ ...state, rival }, effects);
      return { state: next, effects };
    }

    default:
      return refuse(state, effects, `Unknown action ${action.type}`);
  }
}

function refuse(state, effects, message) {
  effects.push({ type: 'toast', message });
  return { state, effects };
}

function withProgress(state, effects) {
  return syncQuests(state, effects);
}

/** Advance tutorial by trigger/id and emit a sheet effect for newly seen steps (except welcome). */
function withTutorial(state, triggerOrId, effects) {
  const before = state.tutorial;
  const tutorial = advanceTutorial(before, triggerOrId);
  if (tutorial === before) return state;
  const newly = (tutorial.seen || []).filter((id) => !(before?.seen || []).includes(id));
  for (const id of newly) {
    if (id === 'welcome') continue;
    const step = TUTORIAL_STEPS.find((s) => s.id === id);
    if (step) effects.push({ type: 'tutorial', id: step.id, title: step.title, text: step.text });
  }
  return { ...state, tutorial };
}

function rememberRival(rival, flag) {
  if (!rival || !flag) return rival;
  const next = {
    ...rival,
    flags: { ...(rival.flags || {}) },
    memory: [...(rival.memory || [])],
  };
  rivalRemember(next, flag);
  return next;
}

function makeGear(slot, age, q) {
  const G = GEAR[slot];
  const base = slot === 'helm' || slot === 'boots' ? 1 : 2;
  const val = Math.max(1, Math.round((base + age * 0.9) * QUAL[q].m / 1.6));
  return {
    id: uid(), slot, art: null, main: G.main, val, age, q,
    name: `${QUAL[q].n} ${G.names[age]}`, ic: G.ic,
  };
}

function grantHeroXp(hero, amount, hallLevel = 0) {
  let H = { ...hero, xp: (hero.xp || 0) + Math.round(amount * (1 + 0.15 * hallLevel)), skills: { ...(hero.skills || {}) } };
  const leveled = [];
  while (H.xp >= H.lvl * 140) {
    H.xp -= H.lvl * 140;
    H.lvl += 1;
    const g = CLASSES[H.cls]?.g || { atk: 0.25, def: 0.25, pow: 0.25, kno: 0.25 };
    const r = Math.random();
    let acc = 0;
    let got = 'atk';
    for (const k in g) {
      acc += g[k];
      if (r <= acc) { got = k; break; }
    }
    H = { ...H, [got]: (H[got] || 0) + 1, pts: (H.pts || 0) + 1, mana: (H.kno || 1) * 10 };
    leveled.push(got);
  }
  return { hero: H, leveled };
}

function applyBattleResult(state, effects, action) {
  const result = action.result || {};
  const opts = action.opts || {};
  const won = result.winner === 'p';
  let next = {
    ...state,
    profile: { ...state.profile, battles: (state.profile.battles || 0) + 1 },
  };

  let army = action.armyAfter
    ? action.armyAfter.map((s) => ({ ...s }))
    : (state.army || []).map((s) => ({ ...s }));

  if (won) {
    next.profile = { ...next.profile, wins: (next.profile.wins || 0) + 1 };
    next = withTutorial(next, 'first-battle', effects);

    // First Aid: recover a fraction of losses vs pre-battle army
    const faLv = next.hero?.skills?.firstaid || 0;
    if (faLv > 0) {
      const recRate = [0, 0.15, 0.3, 0.45][faLv] || 0;
      const beforeById = Object.fromEntries((state.army || []).map((s) => [s.id, s.count]));
      army = army.map((s) => {
        const initial = beforeById[s.id] ?? s.count;
        const lost = Math.max(0, initial - s.count);
        const rec = Math.round(lost * recRate);
        return { ...s, count: Math.min(initial, s.count + rec) };
      });
    }

    // Army XP + ranks
    const xpGain = 15 + (next.age || 0) * 5;
    army = army
      .filter((s) => s.count > 0)
      .map((s) => {
        const xp = (s.xp || 0) + xpGain;
        return { ...s, xp, rank: rankFromXp(xp) };
      });

    const xpHero = grantHeroXp(next.hero, 110 + (next.age || 0) * 20, blOf(next.bld, 'hall'));
    next = { ...next, hero: xpHero.hero };
    for (const got of xpHero.leveled) {
      effects.push({ type: 'toast', message: `Level ${next.hero.lvl} — +1 ${PRIMARIES.find((p) => p.k === got)?.n || got}` });
    }

    // Spoils
    const flags = next.story?.flags || {};
    const baseReward = action.reward || opts.reward || { gold: 120 + next.age * 40 };
    const spoils = withSpoils(flags, baseReward);
    const res = { ...next.res };
    for (const k in spoils) res[k] = (res[k] || 0) + spoils[k];
    next = { ...next, res };

    // Rival defeat or survivor join / hides
    if (opts.rival || action.rival) {
      const rival = {
        ...(next.rival || {}),
        defeated: ((next.rival?.defeated) || 0) + 1,
        wounds: ((next.rival?.wounds) || 0) + 1,
        encounters: Math.max((next.rival?.encounters) || 0, 1),
      };
      next = { ...next, rival };
    } else {
      const join = survivorJoin(flags, next.hero.lvl);
      const foeType = action.foeType || opts.foeType || action.foes?.[0]?.type;
      if (foeType && Math.random() < join.chance && army.length < armySlots(next.bld)) {
        army = [...army, {
          id: uid(), kind: 'creature', type: foeType, age: next.age,
          count: 3 + join.extra + Math.floor(Math.random() * 4),
          rank: 0, xp: 0,
        }];
        next = {
          ...next,
          story: { ...next.story, flags: { ...flags, creature: true } },
        };
        effects.push({ type: 'toast', message: `${CREATURES[foeType]?.n || 'Survivors'} join you` });
      } else if (join.hides) {
        const g = hideGold(next.age);
        next = { ...next, res: { ...next.res, gold: (next.res.gold || 0) + g } };
        effects.push({ type: 'toast', message: `+${g} gold in hides` });
      }
    }

    if (action.nodeIndex != null && next.map?.nodes) {
      const nodes = next.map.nodes.map((n, i) => (
        i === action.nodeIndex ? { ...n, cleared: true } : n
      ));
      next = { ...next, map: { ...next.map, nodes } };
    }
    effects.push({ type: 'victory' }, { type: 'haptic', kind: 'kill' }, { type: 'sfx', kind: 'kill' });
  } else {
    next.profile = { ...next.profile, losses: (next.profile.losses || 0) + 1 };
    army = army.filter((s) => s.count > 0);
    effects.push({ type: 'defeat' });
  }

  next = { ...next, army };
  next = withProgress(next, effects);
  return { state: next, effects };
}

function hireDwelling(state, effects, action) {
  const type = action.creatureType || action.type;
  const C = CREATURES[type];
  if (!C) return refuse(state, effects, 'Unknown creature');
  if (state.army.length >= armySlots(state.bld)) return refuse(state, effects, 'Roster full');
  const offer = action.offer || dwellingOffer(state.story?.flags || {});
  const cost = scaleOfferCost(scaleCost(C.cost, 0), offer.costMul ?? 1);
  if (!canPay(state.res, cost)) return refuse(state, effects, 'Cannot afford');
  const count = action.count || offer.count || 5;
  const stack = { id: uid(), kind: 'creature', type, age: state.age, count, rank: 0, xp: 0 };
  let next = {
    ...state,
    res: pay(state.res, cost),
    army: [...state.army, stack],
    story: {
      ...state.story,
      flags: { ...state.story.flags, creature: true },
    },
  };
  if (action.nodeIndex != null && next.map?.nodes) {
    const nodes = next.map.nodes.map((n, i) => (
      i === action.nodeIndex ? { ...n, cleared: true } : n
    ));
    next = { ...next, map: { ...next.map, nodes } };
  } else if (next.map?.nodes) {
    const nodes = next.map.nodes.map((n, i) => (
      i === next.map.at ? { ...n, cleared: true } : n
    ));
    next = { ...next, map: { ...next.map, nodes } };
  }
  next = withProgress(next, effects);
  effects.push({ type: 'toast', message: `${C.n} joins you` }, { type: 'haptic', kind: 'recruit' });
  return { state: next, effects };
}

function resolveEventChoice(state, effects, action) {
  const flags = state.story?.flags || {};
  const ev = action.event || refugeeEvent(flags);
  const choice = action.choice;
  let next = state;
  const clearNode = () => {
    if (!next.map?.nodes) return next;
    const idx = action.nodeIndex != null ? action.nodeIndex : next.map.at;
    const nodes = next.map.nodes.map((n, i) => (i === idx ? { ...n, cleared: true } : n));
    return { ...next, map: { ...next.map, nodes } };
  };

  if (choice === 'feed') {
    const cost = { food: ev.feedFood || 120 };
    if (!canPay(next.res, cost)) return refuse(state, effects, 'Not enough food');
    let hero = grantHeroXp(next.hero, ev.feedXp || 120, blOf(next.bld, 'hall')).hero;
    next = {
      ...next,
      res: pay(next.res, cost),
      hero,
      story: { ...next.story, flags: { ...flags, generous: true } },
    };
    if (ev.join > 0) {
      if (next.army.length < armySlots(next.bld)) {
        next = {
          ...next,
          army: [...next.army, {
            id: uid(), kind: 'role', type: 'melee', age: next.age,
            count: ev.join, rank: 0, xp: 0,
          }],
        };
        effects.push({ type: 'toast', message: `${ev.join} stay as spears` });
      } else {
        effects.push({ type: 'toast', message: 'Roster full — they move on fed' });
      }
    } else {
      effects.push({ type: 'toast', message: 'You shared your stores' });
    }
  } else if (choice === 'conscript') {
    if (next.army.length >= armySlots(next.bld)) return refuse(state, effects, 'Roster full');
    next = {
      ...next,
      army: [...next.army, {
        id: uid(), kind: 'role', type: 'melee', age: next.age,
        count: ev.conscript || 5, rank: 0, xp: 0,
      }],
      story: { ...next.story, flags: { ...flags, ruthless: true } },
    };
    effects.push({ type: 'toast', message: `${ev.conscript || 5} conscripted` });
  } else {
    return refuse(state, effects, 'Bad choice');
  }

  next = clearNode();
  next = withProgress(next, effects);
  return { state: next, effects };
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
  const flags = state.story?.flags || {};
  const clearAt = (s) => {
    const nodes = s.map.nodes.map((n, i) => (i === s.map.at ? { ...n, cleared: true } : n));
    return { ...s, map: { ...s.map, nodes } };
  };

  if (node.type === 'town') {
    const town = townResupply(flags);
    const hero = {
      ...state.hero,
      mp: heroMovesSafe(state),
      mana: (state.hero.kno || 1) * 10,
    };
    const res = { ...state.res };
    for (const k in town.gain) res[k] = (res[k] || 0) + town.gain[k];
    effects.push({ type: 'toast', message: town.toast });
    return { state: clearAt({ ...state, hero, res }), effects };
  }

  if (node.type === 'resource') {
    const reward = { ...(node.reward || {}) };
    if (!Object.keys(reward).length) {
      reward[pick(makeRng(state.day || 1), ['food', 'wood', 'stone', 'gold'])] = 40 + state.age * 20;
    }
    const res = { ...state.res };
    for (const k in reward) {
      const amt = reward[k] + cacheExtra(flags, k, reward[k]);
      res[k] = (res[k] || 0) + amt;
    }
    effects.push({ type: 'toast', message: 'Caches claimed.' });
    return { state: clearAt({ ...state, res }), effects };
  }

  if (node.type === 'treasure') {
    let gold = Math.round(150 + state.age * 60);
    gold += treasureExtra(flags, gold);
    const res = { ...state.res, gold: (state.res.gold || 0) + gold };
    const xp = grantHeroXp(state.hero, 60, blOf(state.bld, 'hall'));
    effects.push({ type: 'toast', message: `Treasure! +${gold} gold` });
    return { state: clearAt({ ...state, res, hero: xp.hero }), effects };
  }

  if (node.type === 'dwelling') {
    const pool = Object.keys(CREATURES).filter((k) => CREATURES[k].t <= Math.max(1, Math.ceil((state.age + 1) / 2)));
    const type = action.creatureType || pool[Math.floor(Math.random() * pool.length)] || 'wolf';
    const C = CREATURES[type];
    const offer = dwellingOffer(flags);
    const cost = scaleOfferCost(scaleCost(C.cost, 0), offer.costMul);
    if (state.army.length < armySlots(state.bld) && canPay(state.res, cost)) {
      return hireDwelling(state, effects, {
        creatureType: type, count: offer.count, offer, nodeIndex: map.at,
      });
    }
    effects.push({
      type: 'dwelling-offer',
      creatureType: type,
      count: offer.count,
      cost,
      line: offer.line,
      nodeIndex: map.at,
    });
    return { state, effects };
  }

  if (node.type === 'event') {
    const ev = refugeeEvent(flags);
    effects.push({ type: 'event-choices', event: ev, nodeIndex: map.at });
    return { state, effects };
  }

  if (node.type === 'creature' || node.type === 'boss') {
    const rival = node.type === 'boss'
      ? { ...(state.rival || {}), encounters: Math.max((state.rival?.encounters) || 0, 1) }
      : state.rival;
    effects.push({
      type: 'start-fight',
      foes: node.foes,
      boss: node.type === 'boss',
      rival: node.type === 'boss',
      nodeIndex: map.at,
      reward: withSpoils(flags, {
        gold: Math.round(120 * ((node.power || 100) / 100)),
        food: Math.round(80 * ((node.power || 100) / 100)),
      }),
    });
    return { state: rival !== state.rival ? { ...state, rival } : state, effects };
  }

  if (node.type === 'ambush' || node.type === 'garrison') {
    effects.push({ type: 'start-siege', mode: 'site', nodeIndex: map.at });
    return { state, effects };
  }

  effects.push({ type: 'toast', message: 'The road is quiet.' });
  return { state: clearAt(state), effects };
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
  checkMilestones, claimMilestone, syncQuests, QUEST_TEMPLATES,
};
