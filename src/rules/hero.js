/**
 * Hero derived stats — formulas match ages-of-dominion/src/rules/hero.js.
 */
import { SLOTS, ARTIFACTS } from '../data/index.js';
import { clamp } from '../util.js';

export const skillLv = (hero, k) => hero.skills?.[k] || 0;
export const skillLevel = skillLv;

export function heroBonus(hero) {
  const b = { atk: 0, def: 0, pow: 0, kno: 0, morale: 0, luck: 0, move: 0, hpBon: 0, shootBon: 0, spdBon: 0 };
  SLOTS.forEach((s) => {
    const it = hero.equip?.[s.k];
    if (!it) return;
    if (it.art) {
      const A = ARTIFACTS[it.art];
      if (!A) return;
      for (const k in A.b) b[k] = (b[k] || 0) + A.b[k];
    } else if (it.kind === 'artifact' && ARTIFACTS[it.id]) {
      const ab = ARTIFACTS[it.id].b || {};
      for (const k in ab) b[k] = (b[k] || 0) + ab[k];
    } else if (it.stats) {
      for (const k in it.stats) b[k] = (b[k] || 0) + it.stats[k];
    } else if (it.main) {
      b[it.main] = (b[it.main] || 0) + (it.val || 0);
    }
  });
  b.morale += skillLv(hero, 'leadership');
  b.luck += skillLv(hero, 'luck');
  b.move += skillLv(hero, 'logistics');
  return b;
}

export const heroStat = (hero, k) => (hero[k] || 0) + (heroBonus(hero)[k] || 0);

export const heroMorale = (hero) => clamp(heroBonus(hero).morale, -3, 3);
export const heroLuck = (hero) => clamp(heroBonus(hero).luck, -3, 3);

export const manaMax = (hero) => heroStat(hero, 'kno') * 10;

export const heroMoves = (hero) => 5 + heroBonus(hero).move;
