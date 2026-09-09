/**
 * Unit / tower stats + rank ladder.
 * Formulas match ages-of-dominion/src/rules/units.js.
 */
import { ROLES, CREATURES, TOWERS, RANKXP } from '../data/index.js';

export const ageScale = (a) => 1 + 0.55 * a;

export function scaleCost(c, age) {
  const o = {};
  const m = 1 + 0.75 * age;
  for (const k in c) o[k] = Math.round(c[k] * m);
  return o;
}

/** Highest rank index whose XP threshold is met (0..4). */
export function rank(xp) {
  let r = 0;
  for (let i = 1; i < RANKXP.length; i++) {
    if (xp >= RANKXP[i]) r = i;
    else break;
  }
  return r;
}

export const rankFromXp = rank;

/**
 * Derive a stack's live stat block.
 * @param {{kind:'role'|'creature', type:string, age?:number, rank?:number}} stack
 * @param {number} [ageOverride]
 */
export function unitStats(stack, ageOverride) {
  const st = ageOverride !== undefined ? { ...stack, age: ageOverride } : stack;
  let d;
  if (st.kind === 'role') {
    const R = ROLES[st.type];
    if (!R) return null;
    const a = st.age ?? 0;
    const s = ageScale(a);
    d = {
      name: R.names[a],
      n: R.names[a],
      ic: R.ic[a],
      atk: R.atk + a * 2,
      def: R.def + a * 2,
      hp: Math.round(R.hp * s),
      dmin: Math.round(R.dmin * s),
      dmax: Math.round(R.dmax * s),
      spd: R.spd + (a > 3 ? 1 : 0),
      rng: R.rng,
      shots: R.shots,
      block: R.block,
      fly: 0,
    };
  } else {
    const C = CREATURES[st.type];
    if (!C) return null;
    const a = st.age || 0;
    const s = 1 + 0.3 * a;
    d = {
      name: (a > 2 ? 'Elder ' : '') + C.n,
      n: (a > 2 ? 'Elder ' : '') + C.n,
      ic: C.ic,
      atk: C.atk + a,
      def: C.def + a,
      hp: Math.round(C.hp * s),
      dmin: Math.round(C.dmin * s),
      dmax: Math.round(C.dmax * s),
      spd: C.spd,
      rng: C.rng,
      shots: C.shots || 0,
      block: C.block,
      fly: C.fly || 0,
    };
  }
  const r = st.rank || 0;
  d.atk += r;
  d.def += r;
  d.hp = Math.round(d.hp * (1 + 0.08 * r));
  d.dmin = Math.round(d.dmin * (1 + 0.08 * r));
  d.dmax = Math.round(d.dmax * (1 + 0.08 * r));
  if (r >= 2) d.spd += 1;
  if (r >= 4) d.spd += 1;
  return d;
}

export const unitDef = unitStats;

export function towerDef(t) {
  if (typeof t === 'string') return TOWERS[t] || null;
  const T = TOWERS[t.fam];
  if (!T) return null;
  const s = 1 + 0.5 * t.tier;
  const r = t.rank || 0;
  return {
    name: T.names[t.tier],
    ic: T.ic,
    dmg: T.dmg * s * (1 + 0.12 * r),
    rate: T.rate,
    rng: T.rng + (r >= 3 ? 0.3 : 0),
    splash: T.splash || 0,
    slow: T.slow || 0,
    aura: T.aura || 0,
    hp: Math.round((T.hp + 80 * t.tier) * (1 + 0.15 * r)),
  };
}

export function stackPower(stack) {
  const s = unitStats(stack);
  if (!s) return 0;
  const mid = (s.dmin + s.dmax) / 2;
  return Math.round(
    stack.count * (s.hp * 0.35 + mid * 1.2 + s.atk * 0.8 + s.def * 0.5) * (1 + 0.12 * (stack.rank || 0)),
  );
}
