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
