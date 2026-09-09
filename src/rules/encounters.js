/**
 * Encounter power / host power / verdicts.
 */
import { CREATURES } from '../data/index.js';
import { heroStat } from './hero.js';
import { stackPower } from './units.js';

export const AGE_POWER = [0.95, 1.72, 2.05, 1.85, 1.95, 1.80, 1.90];

export function encounterPower(n = {}, age = 0) {
  if (Array.isArray(n)) {
    let p = 0;
    for (const s of n) p += stackPower(s);
    return Math.round(p);
  }
  const boss = n.type === 'boss';
  const row = n.row !== undefined ? n.row : 2;
  return (1 + age * 0.44) * (1 + row * 0.22) * (boss ? 1.8 : 1) * (AGE_POWER[age] ?? 1.9);
}

export function makePack(n = {}, age = 0, rng = Math.random) {
  const boss = n.type === 'boss';
  const row = n.row !== undefined ? n.row : 2;
  const tierCap = Math.max(1, Math.ceil((age + 2) / 2));
  const pool = Object.keys(CREATURES).filter((k) => CREATURES[k].t <= tierCap);
  const stacks = [];
  const num = boss ? Math.floor(rng() * 2) + 3 : Math.floor(rng() * 2) + 2;
  const power = encounterPower(n, age);

  for (let i = 0; i < num; i++) {
    const k = pool[Math.floor(rng() * pool.length) % pool.length];
    const C = CREATURES[k];
    const count = Math.max(2, Math.round(((6 + row * 2) * power) / (1 + C.t * 0.8)));
    stacks.push({ kind: 'creature', type: k, age, rank: 0, count });
  }
  return { stacks, boss, power };
}

export function calcHostPower(army = [], hero = null) {
  let p = 0;
  for (const s of army) p += stackPower(s);
  if (hero) p += heroStat(hero, 'atk') * 8 + heroStat(hero, 'def') * 6;
  return Math.round(p);
}

/**
 * @param {number} hostPower
 * @param {number} foePower
 * @returns {'easy'|'even'|'risky'|'deadly'}
 */
export function encounterVerdict(hostPower, foePower) {
  if (!hostPower || hostPower <= 0) return 'deadly';
  const ratio = foePower / hostPower;
  if (ratio < 0.7) return 'easy';
  if (ratio < 1.05) return 'even';
  if (ratio < 1.45) return 'risky';
  return 'deadly';
}

export function verdictLabel(v) {
  if (!v) return '';
  if (typeof v === 'object') return v.label || v.verdict || '';
  return ({ easy: 'Easy', even: 'Even', risky: 'Risky', deadly: 'Deadly' })[v] || String(v);
}

export function verdictDetails(hostPower, foePower) {
  const verdict = encounterVerdict(hostPower, foePower);
  return {
    verdict,
    label: verdictLabel(verdict),
    cue: ({ easy: '✓', even: '≈', risky: '▲', deadly: '✕' })[verdict],
    ratio: hostPower ? foePower / hostPower : Infinity,
  };
}
