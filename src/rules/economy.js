import { BUILDINGS, AGES } from '../data/index.js';

export const blOf = (bld, id) => (bld[id] ? bld[id].l : 0);

export function bcost(id, lvl) {
  const B = BUILDINGS[id], o = {};
  for (const k in B.c) o[k] = Math.round(B.c[k] * Math.pow(B.g, lvl));
  return o;
}

export function scaleCost(c, age) {
  const o = {}, m = 1 + 0.75 * age;
  for (const k in c) o[k] = Math.round(c[k] * m);
  return o;
}

export const rates = (bld) => ({
  food: 0.55 * blOf(bld, 'farm'),
  wood: 0.45 * blOf(bld, 'lumber'),
  stone: 0.35 * blOf(bld, 'quarry'),
  gold: 0.25 * blOf(bld, 'mine'),
});

export const armySlots = (bld) => 2 + blOf(bld, 'barracks');
export const towerSlots = (bld) => 2 + blOf(bld, 'workshop');
export const coreHP = (bld, age) => 400 + 180 * blOf(bld, 'walls') + 60 * age;

export function ageUpCost(age) {
  const a = age + 1, m = Math.pow(2.15, a);
  return {
    food: Math.round(300 * m), wood: Math.round(280 * m),
    stone: Math.round(220 * m), gold: Math.round(180 * m),
  };
}

export function canPay(res, cost) {
  for (const k in cost) if ((res[k] || 0) < cost[k]) return false;
  return true;
}

export function pay(res, cost) {
  const out = { ...res };
  for (const k in cost) out[k] = (out[k] || 0) - cost[k];
  return out;
}

export function addRes(res, gain) {
  const out = { ...res };
  for (const k in gain) out[k] = (out[k] || 0) + gain[k];
  return out;
}

export function calcAgeUpPrompt(age, townhallLevel, resources = {}, cost = null) {
  if (age >= 6) return { title: 'Modern Age', sub: 'Final age reached', ready: false };
  const nextAge = AGES[age + 1]?.n || 'Next Age';
  const needTh = age + 2;
  const th = townhallLevel || 0;
  if (th < needTh) {
    return { title: 'Advance Age', sub: `Town Hall ${needTh} → ${nextAge}`, ready: false };
  }
  const c = cost || ageUpCost(age);
  let maxShortfall = 0;
  let maxResKey = null;
  for (const k in c) {
    const short = c[k] - (resources[k] || 0);
    if (short > maxShortfall) {
      maxShortfall = short;
      maxResKey = k;
    }
  }
  if (maxShortfall > 0) {
    return { title: 'Advance Age', sub: `Need ${maxShortfall} ${maxResKey}`, ready: false };
  }
  return { title: `Advance to ${nextAge}`, sub: 'Ready', ready: true };
}
