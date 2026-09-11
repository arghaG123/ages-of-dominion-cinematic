/**
 * Board-aware tactical combat. Live UI and Resolve share this engine.
 * Damage/initiative are computed here; animations only observe returned events.
 */
import { calcDamage, applyDamage, createRng, FC, FR, pickTurningPoint, decodeChallenge } from './combat.js';

export function occupied(units, x, y) {
  return units.some((u) => !u.dead && u.x === x && u.y === y);
}

export function unitAt(units, x, y) {
  return units.find((u) => !u.dead && u.x === x && u.y === y);
}

export function adj(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

export function hasAdjEnemy(units, u) {
  return units.some((e) => !e.dead && e.side !== u.side && adj(u, e));
}

export function effSpd(u, spdBon = 0) {
  return Math.max(1, (u.spd || 1) + (u.haste || 0) - (u.slowT || 0) + (u.side === 'p' ? spdBon : 0));
}

export function reach(units, u, spdBon = 0) {
  const dest = {};
  const visited = {};
  const q = [{ x: u.x, y: u.y, d: 0 }];
  visited[`${u.x},${u.y}`] = 0;
  const mv = Math.max(1, effSpd(u, spdBon));
  while (q.length) {
    const c = q.shift();
    if (c.d >= mv) continue;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = c.x + dx;
        const ny = c.y + dy;
        const k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= FC || ny >= FR) continue;
        if (visited[k] !== undefined) continue;
        const occ = occupied(units, nx, ny);
        if (occ && !u.fly) continue;
        visited[k] = c.d + 1;
        if (!occ) dest[k] = c.d + 1;
        q.push({ x: nx, y: ny, d: c.d + 1 });
      }
    }
  }
  return dest;
}

export function strikeKind(units, u, t, spdBon = 0) {
  if (!u || !t || t.dead || t.side === u.side) return null;
  if (u.rng > 0 && u.shots > 0 && !hasAdjEnemy(units, u)) return 'ranged';
  if (adj(u, t)) return 'melee';
  const rc = reach(units, u, spdBon);
  for (const k in rc) {
    const [x, y] = k.split(',').map(Number);
    if (Math.max(Math.abs(x - t.x), Math.abs(y - t.y)) <= 1) return 'melee';
  }
  return null;
}

function boardUnit(s, side, x, y) {
  const uhp = s.uhp || s.hp || 1;
  const name = s.n || s.name || s.type;
  return {
    ...s,
    id: s.id,
    name,
    n: name,
    type: s.type,
    kind: s.kind,
    atk: s.atk,
    def: s.def,
    dmin: s.dmin,
    dmax: s.dmax,
    spd: s.spd || 1,
    rng: s.rng || 0,
    shots: s.shots || 0,
    count: s.count,
    maxCount: s.maxCount ?? s.count,
    uhp,
    top: s.top ?? uhp,
    side,
    x: typeof x === 'number' ? x : (typeof s.x === 'number' ? s.x : 0),
    y: typeof y === 'number' ? y : (typeof s.y === 'number' ? s.y : 0),
    dead: !!s.dead || s.count <= 0,
    retaliated: !!s.retaliated,
    defending: !!s.defending,
    bless: s.bless || 0,
    haste: s.haste || 0,
    slowT: s.slowT || 0,
    fly: s.fly || 0,
    dealt: s.dealt || 0,
    waited: !!s.waited,
    boss: !!s.boss,
    stackType: s.stackType || s.type,
  };
}

function placeDefault(player, enemy, placeRows = 1) {
  const units = [];
  let col = 0;
  let row = FR - placeRows;
  for (const s of player) {
    while (row < FR && occupied(units, col, row)) {
      col += 1;
      if (col >= FC) { col = 0; row += 1; }
    }
    if (row >= FR) break;
    units.push(boardUnit(s, 'p', col, row));
    col += 1;
    if (col >= FC) { col = 0; row += 1; }
  }
  enemy.forEach((s, i) => {
    units.push(boardUnit(s, 'e', i % FC, Math.floor(i / FC)));
  });
  return units;
}

function cloneUnit(u) {
  return { ...u };
}

function unitKey(u) {
  return `${u.side}:${u.id}`;
}

/**
 * Mutable board simulation. `units` are live objects so the UI can share them.
 */
export function createTacticalBattle(input = {}, rngArg) {
  const rng = typeof rngArg === 'function'
    ? rngArg
    : (typeof input.rng === 'function' ? input.rng : createRng(input.seed ?? 123456789));
  const hero = input.hero || null;
  const spdBon = hero?.spdBon || input.spdBon || 0;
  const boss = !!input.boss;
  const mods = input.mods || {};
  const maxRounds = input.maxRounds || 40;
  const placeRows = input.placeRows || 1;
  const seed = input.seed;

  const units = input.units
    ? input.units
    : placeDefault(input.playerStacks || input.player || [], input.enemyStacks || input.enemy || [], placeRows);

  let round = input.round || 1;
  let turn = input.turn || 0;
  let order = input.order ? input.order.slice() : [];
  const events = input.events || [];
  let started = order.length > 0;

  function alive(side) {
    return units.filter((u) => (!side || u.side === side) && !u.dead && u.count > 0);
  }

  function isOver() {
    return !alive('p').length || !alive('e').length;
  }

  function buildOrder() {
    units.forEach((u) => {
      u.retaliated = false;
      u.defending = false;
      u.waited = false;
    });
    order = units
      .filter((u) => !u.dead && u.count > 0)
      .sort((a, b) => effSpd(b, spdBon) - effSpd(a, spdBon) || (rng() - 0.5));
    turn = 0;
    if (input.onRoundStart) input.onRoundStart();
  }

  function start() {
    if (!started) {
      units.filter((u) => u.side === 'p').forEach((u) => {
        if (u.maxCount === undefined) u.maxCount = u.count;
      });
      buildOrder();
      started = true;
    }
    return api;
  }

  function current() {
    return order[turn] || null;
  }

  function tickDurations(u) {
    if (!u) return;
    if (u.bless > 0) u.bless--;
    if (u.haste > 0) u.haste--;
    if (u.slowT > 0) u.slowT--;
  }

  function skipDead() {
    while (turn < order.length && order[turn].dead) turn++;
  }

  function advanceTurn() {
    tickDurations(current());
    turn++;
    skipDead();
    if (turn >= order.length) {
      round++;
      buildOrder();
      skipDead();
    }
    return { over: isOver() || round > maxRounds, current: current(), round, turn };
  }

  function applyStrike(a, t, ranged) {
    const hit = calcDamage(a, t, {
      ranged,
      hero,
      mods,
      adjacentEnemy: hasAdjEnemy(units, a),
      boss,
      rng,
    });
    const res = applyDamage(t, hit.dmg);
    a.dealt = (a.dealt || 0) + hit.dmg;
    if (ranged) a.shots = Math.max(0, (a.shots || 0) - 1);
    const evs = [{
      type: 'strike',
      round,
      side: a.side,
      from: a.id,
      to: t.id,
      actor: a.n || a.name || a.type,
      target: t.n || t.name || t.type,
      dmg: hit.dmg,
      slain: res.killed,
      killed: res.killed,
      dead: res.dead,
      ranged,
      lucky: hit.lucky,
    }];
    if (!ranged && !res.dead && !t.retaliated && t.count > 0) {
      t.retaliated = true;
      const back = calcDamage(t, a, {
        ranged: false,
        hero,
        mods,
        adjacentEnemy: hasAdjEnemy(units, t),
        boss,
        rng,
      });
      const backRes = applyDamage(a, back.dmg);
      evs.push({
        type: 'retaliate',
        round,
        side: t.side,
        from: t.id,
        to: a.id,
        actor: t.n || t.name || t.type,
        target: a.n || a.name || a.type,
        dmg: back.dmg,
        slain: backRes.killed,
        killed: backRes.killed,
        dead: backRes.dead,
        retal: true,
      });
    }
    for (const ev of evs) events.push(ev);
    return evs;
  }

  function closeIn(u, t) {
    const rc = reach(units, u, spdBon);
    let best = null;
    let bd = 1e9;
    for (const k in rc) {
      const [x, y] = k.split(',').map(Number);
      const d = Math.max(Math.abs(x - t.x), Math.abs(y - t.y));
      if (d <= 1 && rc[k] < bd) {
        bd = rc[k];
        best = k;
      }
    }
    if (!best) return false;
    const [x, y] = best.split(',').map(Number);
    u.x = x;
    u.y = y;
    return true;
  }

  function strike(u, t) {
    const kind = strikeKind(units, u, t, spdBon);
    if (!kind) return { ok: false, events: [] };
    if (kind === 'ranged') return { ok: true, events: applyStrike(u, t, true), kind };
    if (!adj(u, t) && !closeIn(u, t)) return { ok: false, events: [] };
    return { ok: true, events: applyStrike(u, t, false), kind: 'melee' };
  }

  function move(u, x, y) {
    const rc = reach(units, u, spdBon);
    if (rc[`${x},${y}`] === undefined) return { ok: false };
    u.x = x;
    u.y = y;
    return { ok: true };
  }

  function wait(u) {
    const idx = order.indexOf(u);
    if (idx < 0) return { ok: false };
    order.splice(idx, 1);
    order.push(u);
    u.waited = true;
    if (idx <= turn) turn--;
    return { ok: true };
  }

  function defend(u) {
    u.defending = true;
    return { ok: true };
  }

  function chooseAiTarget(u) {
    const foes = alive(u.side === 'p' ? 'e' : 'p');
    if (!foes.length) return null;
    const score = (t) => (t.count * (t.dmin + t.dmax)) / 2 / (1 + t.def * 0.05)
      - Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y)) * 2;
    return foes.slice().sort((a, b) => score(b) - score(a))[0];
  }

  function autoAct() {
    start();
    if (isOver()) return { over: true, events: [] };
    const u = current();
    if (!u || u.dead) {
      const adv = advanceTurn();
      return { over: adv.over || isOver(), events: [] };
    }
    const target = chooseAiTarget(u);
    let evs = [];
    if (target) {
      if (u.rng > 0 && u.shots > 0 && !hasAdjEnemy(units, u)) {
        evs = applyStrike(u, target, true);
      } else {
        const rc = reach(units, u, spdBon);
        let best = null;
        let bd = 1e9;
        for (const k in rc) {
          const [x, y] = k.split(',').map(Number);
          const d = Math.max(Math.abs(x - target.x), Math.abs(y - target.y));
          if (d < bd || (d === bd && (!best || rc[k] < rc[best]))) {
            bd = d;
            best = k;
          }
        }
        if (best) {
          const [x, y] = best.split(',').map(Number);
          u.x = x;
          u.y = y;
        }
        if (adj(u, target)) evs = applyStrike(u, target, false);
      }
    }
    const adv = advanceTurn();
    return { over: adv.over || isOver(), events: evs, current: adv.current };
  }

  function snapshot() {
    const survivingP = alive('p');
    const survivingE = alive('e');
    const win = survivingP.length > 0 && survivingE.length === 0;
    return {
      win,
      winner: win ? 'p' : 'e',
      rounds: round,
      player: units.filter((u) => u.side === 'p'),
      enemy: units.filter((u) => u.side === 'e'),
      events: events.slice(),
      turningPoint: pickTurningPoint(events),
      seed,
    };
  }

  function runToEnd() {
    start();
    let guard = 0;
    while (!isOver() && round <= maxRounds && guard++ < 4000) {
      autoAct();
    }
    return snapshot();
  }

  function clone() {
    const clonedUnits = units.map(cloneUnit);
    const byKey = new Map(clonedUnits.map((u) => [unitKey(u), u]));
    const clonedOrder = order.map((u) => byKey.get(unitKey(u))).filter(Boolean);
    const clonedRng = typeof rng.clone === 'function' ? rng.clone() : createRng(seed ?? 123456789);
    return createTacticalBattle({
      units: clonedUnits,
      rng: clonedRng,
      hero,
      spdBon,
      boss,
      mods,
      maxRounds,
      placeRows,
      seed,
      round,
      turn,
      order: clonedOrder,
      events: [],
    });
  }

  const api = {
    units,
    rng,
    get round() { return round; },
    get turn() { return turn; },
    get order() { return order; },
    events,
    hero,
    spdBon,
    start,
    current,
    isOver,
    alive,
    reach: (u) => reach(units, u, spdBon),
    occupied: (x, y) => occupied(units, x, y),
    unitAt: (x, y) => unitAt(units, x, y),
    hasAdjEnemy: (u) => hasAdjEnemy(units, u),
    strikeKind: (u, t) => strikeKind(units, u, t, spdBon),
    effSpd: (u) => effSpd(u, spdBon),
    strike,
    move,
    wait,
    defend,
    autoAct,
    advanceTurn,
    runToEnd,
    snapshot,
    clone,
    previewDamage(attacker, defender, ranged) {
      return calcDamage(attacker, defender, {
        ranged,
        hero,
        mods,
        adjacentEnemy: hasAdjEnemy(units, attacker),
        boss,
        rng: () => 0.5,
      });
    },
  };
  return api;
}

/**
 * Headless fight through the same board engine the live UI uses.
 */
export function resolveBattle(input = {}, rngArg) {
  return createTacticalBattle(input, rngArg).runToEnd();
}

export function replayChallenge(challengeOrCode, options = {}) {
  const challenge = typeof challengeOrCode === 'string'
    ? decodeChallenge(challengeOrCode)
    : challengeOrCode;
  if (!challenge) throw new Error('invalid-challenge');
  const rng = createRng(challenge.seed);
  return resolveBattle({
    playerStacks: challenge.playerStacks,
    enemyStacks: challenge.enemyStacks,
    rng,
    ...options,
  });
}
