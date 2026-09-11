/**
 * Pure tactical combat — results only, no animations.
 * Formulas match ages-of-dominion/src/rules/combat.js.
 */

export const FC = 7;
export const FR = 10;

export function calcDamage(attacker, defender, {
  ranged = false,
  hero = null,
  mods = {},
  adjacentEnemy = false,
  boss = false,
  rng = Math.random,
} = {}) {
  const hAtk = hero?.atk || 0;
  const hDef = hero?.def || 0;
  const hLuck = hero?.luck || 0;
  const skills = hero?.skills || {};
  const offenseLv = typeof skills.offense === 'number' ? skills.offense : 0;
  const archeryLv = typeof skills.archery === 'number' ? skills.archery : 0;
  const armorerLv = typeof skills.armorer === 'number' ? skills.armorer : 0;
  const shootBon = hero?.shootBon || 0;

  const aAtk = attacker.atk + (attacker.side === 'p' ? hAtk : (boss || attacker.boss ? 2 : 0));
  const dDef = defender.def + (defender.side === 'p' ? hDef : 0) + (defender.defending ? 3 : 0);

  let base = 0;
  const unitCount = Math.min(attacker.count, 60);
  const spread = attacker.dmax - attacker.dmin;
  for (let i = 0; i < unitCount; i++) {
    base += attacker.bless ? attacker.dmax : attacker.dmin + Math.floor(rng() * (spread + 1));
  }
  if (attacker.count > 60) base *= attacker.count / 60;

  const add = aAtk - dDef;
  let mul = add > 0 ? 1 + Math.min(3, 0.05 * add) : 1 - Math.min(0.7, 0.025 * -add);

  if (attacker.side === 'p') {
    if (!ranged) mul *= 1 + [0, 0.1, 0.2, 0.3][offenseLv || 0];
    else mul *= 1 + [0, 0.1, 0.25, 0.5][archeryLv || 0] + shootBon;
  }
  if (defender.side === 'p') mul *= 1 - [0, 0.05, 0.1, 0.15][armorerLv || 0];

  if (ranged) {
    if (adjacentEnemy || attacker.adjacentEnemy) mul *= 0.5;
    mul *= 1 - (mods.shootPen || 0) + (mods.shootBon || 0);
  }
  if (defender.defending) mul *= 0.85;

  let lucky = false;
  if (attacker.side === 'p' && hLuck > 0 && rng() < hLuck * 0.042) {
    mul *= 2;
    lucky = true;
  }
  return { dmg: Math.max(1, Math.round(base * mul)), lucky };
}

export function applyDamage(target, damage) {
  const pool = (target.count - 1) * target.uhp + target.top - damage;
  if (pool <= 0) {
    const killed = target.count;
    target.count = 0;
    target.top = 0;
    target.dead = true;
    return { killed, dead: true };
  }
  const nc = Math.ceil(pool / target.uhp);
  const killed = target.count - nc;
  target.count = nc;
  target.top = pool - (nc - 1) * target.uhp;
  return { killed, dead: false };
}

export function killedByDamage(target, damage) {
  const count = target.count || 0;
  const uhp = target.uhp || target.hp || 1;
  const top = target.top ?? uhp;
  const pool = (count - 1) * uhp + top - damage;
  if (pool <= 0) return count;
  return Math.max(0, count - Math.ceil(pool / uhp));
}

export function createRng(seed = 123456789) {
  let s = seed >>> 0;
  const rng = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  rng.state = () => s;
  rng.setState = (v) => { s = v >>> 0; };
  rng.clone = () => {
    const c = createRng(0);
    c.setState(s);
    return c;
  };
  return rng;
}

export function pickTurningPoint(events = []) {
  if (!events.length) return null;
  return events.reduce((best, e) => {
    const score = (e.slain || 0) * 1000 + (e.dmg || 0);
    const bestScore = (best.slain || 0) * 1000 + (best.dmg || 0);
    return score > bestScore ? e : best;
  });
}

export { resolveBattle, replayChallenge } from './tactical.js';

function toB64(str) {
  if (typeof btoa === 'function') return btoa(str);
  return Buffer.from(str, 'utf8').toString('base64');
}
function fromB64(str) {
  if (typeof atob === 'function') return atob(str);
  return Buffer.from(str, 'base64').toString('utf8');
}

export function encodeChallenge({
  seed = 12345, age = 0, playerStacks, enemyStacks, player, enemy,
} = {}) {
  const p = playerStacks || player || [];
  const e = enemyStacks || enemy || [];
  const slim = (u) => ({
    id: u.id, name: u.name, type: u.type, kind: u.kind, count: u.count, rank: u.rank || 0,
    uhp: u.uhp, hp: u.hp, atk: u.atk, def: u.def, dmin: u.dmin, dmax: u.dmax,
    spd: u.spd, rng: u.rng, shots: u.shots,
  });
  return toB64(JSON.stringify({ s: seed, a: age, p: p.map(slim), e: e.map(slim) }));
}

export function decodeChallenge(str) {
  try {
    let raw = String(str).trim();
    if (raw.startsWith('AOD1.')) raw = raw.slice(5);
    const parsed = JSON.parse(fromB64(raw));
    if (parsed?.v === 1) {
      return { seed: parsed.seed, age: parsed.age || 0, playerStacks: parsed.player || [], enemyStacks: parsed.enemy || [] };
    }
    if (!parsed || typeof parsed.s !== 'number') return null;
    return {
      seed: parsed.s,
      age: parsed.a || 0,
      playerStacks: parsed.p || [],
      enemyStacks: parsed.e || [],
    };
  } catch {
    return null;
  }
}

export const fdamage = calcDamage;
export const applyDmg = applyDamage;
