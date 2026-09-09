import { describe, it, expect } from 'vitest';
import { calcDamage, resolveBattle, encodeChallenge, decodeChallenge, replayChallenge } from '../src/rules/combat.js';
import { resolveSiege, genPath } from '../src/rules/siege.js';
import { calcGridGeometry, needsResize } from '../src/render/canvas.js';
import { rates, bcost, ageUpCost, canPay } from '../src/rules/economy.js';
import { buildDurationMs, resolveBuilds, startBuild } from '../src/rules/builds.js';
import { encounterVerdict, calcHostPower } from '../src/rules/encounters.js';
import { newGame } from '../src/state/factory.js';
import { calculateOfflineProgress } from '../src/state/offline.js';
import { dispatch } from '../src/game/dispatch.js';

describe('rules', () => {
  it('economy rates and costs', () => {
    const r = rates({ farm: { l: 2 }, lumber: { l: 1 }, quarry: { l: 0 }, mine: { l: 1 } });
    expect(r.food).toBeCloseTo(1.1);
    expect(bcost('farm', 0).wood).toBe(35);
    expect(ageUpCost(0).food).toBeGreaterThan(300);
    expect(canPay({ food: 10 }, { food: 5 })).toBe(true);
  });

  it('build duration band and resolve', () => {
    expect(buildDurationMs('quarry', 0)).toBe(3000);
    const d = buildDurationMs('townhall', 3);
    expect(d).toBeGreaterThanOrEqual(3000);
    expect(d).toBeLessThanOrEqual(8000);
    let s = newGame('Kael', 'banner', 'knight');
    s = startBuild(s, 'quarry');
    const done = resolveBuilds(s, Date.now() + 4000);
    expect(done.completed.length).toBe(1);
    expect(done.state.bld.quarry.l).toBe(1);
  });

  it('combat is deterministic by seed', () => {
    const player = [{ id: 'p1', kind: 'role', type: 'melee', count: 10, atk: 4, def: 5, hp: 11, dmin: 2, dmax: 4, spd: 5, rng: 0, shots: 0 }];
    const enemy = [{ id: 'e1', kind: 'creature', type: 'wolf', count: 6, atk: 6, def: 3, hp: 10, dmin: 2, dmax: 5, spd: 7, rng: 0, shots: 0 }];
    const a = resolveBattle({ seed: 42, player, enemy });
    const b = resolveBattle({ seed: 42, player, enemy });
    expect(a.winner).toBe(b.winner);
    expect(a.events.length).toBe(b.events.length);
  });

  it('challenge encode/replay', () => {
    const player = [{ id: 'p1', kind: 'role', type: 'melee', count: 8, atk: 4, def: 5, hp: 11, dmin: 2, dmax: 4, spd: 5, rng: 0, shots: 0 }];
    const enemy = [{ id: 'e1', kind: 'creature', type: 'wolf', count: 5, atk: 6, def: 3, hp: 10, dmin: 2, dmax: 5, spd: 7, rng: 0, shots: 0 }];
    const code = encodeChallenge({ seed: 7, age: 0, player, enemy });
    expect(decodeChallenge(code).seed).toBe(7);
    const result = replayChallenge(code);
    expect(['p', 'e']).toContain(result.winner);
  });

  it('siege path and resolve', () => {
    const path = genPath(9, 15, 1);
    expect(path.length).toBe(15);
    const r = resolveSiege({ towers: [{ fam: 'arrow', rank: 0 }], waves: 3, seed: 3, bld: { walls: { l: 1 } }, age: 0 });
    expect(r.pathLen).toBe(15);
    expect(typeof r.won).toBe('boolean');
  });

  it('verdicts and host power', () => {
    expect(encounterVerdict(100, 50)).toBe('easy');
    expect(encounterVerdict(100, 100)).toBe('even');
    expect(encounterVerdict(100, 130)).toBe('risky');
    expect(encounterVerdict(100, 200)).toBe('deadly');
    const s = newGame('Kael', 'banner', 'knight');
    expect(calcHostPower(s.army, s.hero)).toBeGreaterThan(0);
  });

  it('offline resolves builds before income', () => {
    let s = newGame('Kael', 'banner', 'knight');
    s = startBuild(s, 'quarry', Date.now() - 10000);
    s = { ...s, t: Date.now() - 6 * 60 * 60 * 1000 };
    const result = calculateOfflineProgress(s, Date.now());
    expect(result.state.bld.quarry.l).toBe(1);
    expect(result.grant).toBeTruthy();
  });

  it('dispatch recruit reinforces matching stack', () => {
    let s = newGame('Kael', 'banner', 'knight');
    const before = s.army.length;
    const r1 = dispatch(s, { type: 'recruit', unitType: 'melee' });
    s = r1.state;
    expect(s.army.length).toBe(before);
    expect(s.army.find((x) => x.type === 'melee').count).toBe(17);
  });

  it('tutorial advances past welcome on ack then first-build', () => {
    let s = newGame('Kael', 'banner', 'knight');
    s = dispatch(s, { type: 'tutorial-ack', id: 'welcome' }).state;
    expect(s.tutorial.seen).toContain('welcome');
    expect(s.tutorial.step).toBe(1);
    const built = dispatch(s, { type: 'build', buildingId: 'quarry' });
    expect(built.state.tutorial.seen).toContain('first-build');
    expect(built.effects.some((e) => e.type === 'tutorial' && e.id === 'first-build')).toBe(true);
  });

  it('winning battle clears map node via apply-battle-result', () => {
    let s = newGame('Kael', 'banner', 'knight');
    s = dispatch(s, { type: 'gen-map' }).state;
    const idx = s.map.nodes.findIndex((n) => n.type === 'creature');
    expect(idx).toBeGreaterThanOrEqual(0);
    s = {
      ...s,
      map: { ...s.map, at: idx },
    };
    const after = dispatch(s, {
      type: 'apply-battle-result',
      result: { winner: 'p' },
      nodeIndex: idx,
      armyAfter: s.army,
    }).state;
    expect(after.map.nodes[idx].cleared).toBe(true);
  });

  it('siege rewards go through apply-siege-result', () => {
    let s = newGame('Kael', 'banner', 'knight');
    const goldBefore = s.res.gold;
    const after = dispatch(s, {
      type: 'apply-siege-result',
      result: { won: true, waves: 5, gold: 90 },
    }).state;
    expect(after.res.gold).toBe(goldBefore + 90);
    expect(after.endlessBest).toBe(5);
    expect(after.profile.sieges).toBe(1);
  });

  it('claim-milestone grants reward when met', () => {
    let s = newGame('Kael', 'banner', 'knight');
    s = { ...s, profile: { ...s.profile, wins: 1 }, bld: { ...s.bld, quarry: { l: 1 } } };
    const goldBefore = s.res.gold;
    const r = dispatch(s, { type: 'claim-milestone', id: 'first_battle' });
    expect(r.state.claimedMilestones).toContain('first_battle');
    expect(r.state.res.gold).toBeGreaterThan(goldBefore);
  });

  it('market-trade swaps 100 for 80 after bronze', () => {
    let s = newGame('Kael', 'banner', 'knight');
    s = { ...s, age: 1, res: { ...s.res, food: 200, wood: 50 } };
    const r = dispatch(s, { type: 'market-trade', from: 'food', to: 'wood' });
    expect(r.state.res.food).toBe(100);
    expect(r.state.res.wood).toBe(130);
  });

  it('forge and equip put gear on hero', () => {
    let s = newGame('Kael', 'banner', 'knight');
    s = {
      ...s,
      bld: { ...s.bld, armory: { l: 1 } },
      res: { ...s.res, wood: 500, stone: 500, gold: 500 },
    };
    const forged = dispatch(s, { type: 'forge', slot: 'weapon' });
    expect(forged.state.hero.bag.length).toBe(1);
    const equipped = dispatch(forged.state, { type: 'equip', index: 0 });
    expect(equipped.state.hero.equip.weapon).toBeTruthy();
    expect(equipped.state.hero.bag.length).toBe(0);
  });

  it('apply-battle-result completes win quest and grants army xp', () => {
    let s = newGame('Kael', 'banner', 'knight');
    const beforeXp = s.army[0].xp || 0;
    const r = dispatch(s, {
      type: 'apply-battle-result',
      result: { winner: 'p' },
      armyAfter: s.army,
      reward: { gold: 10 },
      opts: { rival: false },
    });
    expect(r.state.profile.wins).toBe(1);
    expect(r.state.army[0].xp).toBeGreaterThan(beforeXp);
    const q1 = r.state.quests.find((q) => q.id === 'q1');
    expect(q1.done).toBe(true);
  });

  it('spend-stat and learn-skill consume hero points', () => {
    let s = newGame('Kael', 'banner', 'knight');
    s = { ...s, hero: { ...s.hero, pts: 2 } };
    const atk = s.hero.atk;
    s = dispatch(s, { type: 'spend-stat', stat: 'atk' }).state;
    expect(s.hero.atk).toBe(atk + 1);
    expect(s.hero.pts).toBe(1);
    s = dispatch(s, { type: 'learn-skill', skill: 'offense' }).state;
    expect(s.hero.skills.offense).toBe(1);
    expect(s.hero.pts).toBe(0);
  });

  it('travel advances first-travel tutorial', () => {
    let s = newGame('Kael', 'banner', 'knight');
    s = dispatch(s, { type: 'tutorial-ack', id: 'welcome' }).state;
    s = dispatch(s, { type: 'tutorial-ack', id: 'first-build' }).state;
    s = dispatch(s, { type: 'tutorial-ack', id: 'first-recruit' }).state;
    s = dispatch(s, { type: 'gen-map' }).state;
    const dest = s.map.links[s.map.at][0];
    const r = dispatch(s, { type: 'travel', nodeIndex: dest });
    expect(r.state.tutorial.seen).toContain('first-travel');
  });

  it('event-choice feed spends food and marks generous', () => {
    let s = newGame('Kael', 'banner', 'knight');
    s = { ...s, res: { ...s.res, food: 200 } };
    const r = dispatch(s, { type: 'event-choice', choice: 'feed' });
    expect(r.state.res.food).toBeLessThan(200);
    expect(r.state.story.flags.generous).toBe(true);
  });

  it('hire-dwelling adds a creature stack', () => {
    let s = newGame('Kael', 'banner', 'knight');
    s = { ...s, res: { ...s.res, food: 500, gold: 500 }, bld: { ...s.bld, barracks: { l: 3 } } };
    const before = s.army.length;
    const r = dispatch(s, { type: 'hire-dwelling', creatureType: 'wolf', count: 5 });
    expect(r.state.army.length).toBe(before + 1);
    expect(r.state.army.some((a) => a.kind === 'creature' && a.type === 'wolf')).toBe(true);
    expect(r.state.story.flags.creature).toBe(true);
  });

  it('rival-duel emits start-fight and bumps encounters', () => {
    let s = newGame('Kael', 'banner', 'knight');
    const before = s.rival.encounters || 0;
    const r = dispatch(s, { type: 'rival-duel' });
    expect(r.state.rival.encounters).toBe(before + 1);
    expect(r.effects.some((e) => e.type === 'start-fight' && e.rival)).toBe(true);
  });
});

describe('geometry', () => {
  it('fits tactical grid in 375x623', () => {
    const g = calcGridGeometry(375, 623, 7, 10);
    expect(g.offsetY + 10 * g.cellSize).toBeLessThanOrEqual(623 + 0.01);
    expect(needsResize(727, 727, 375, 623)).toBe(true);
  });

  it('calcDamage returns positive', () => {
    const { dmg } = calcDamage(
      { atk: 4, def: 5, count: 5, dmin: 2, dmax: 4, side: 'p' },
      { atk: 3, def: 3, count: 5, dmin: 1, dmax: 3, side: 'e', uhp: 10, top: 10 },
      { rng: () => 0.5 },
    );
    expect(dmg).toBeGreaterThan(0);
  });
});
